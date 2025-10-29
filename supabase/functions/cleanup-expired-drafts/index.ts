import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log(`🧹 [CLEANUP] Iniciando cleanup automático de drafts expirados - ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('PROJECT_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular timestamps - MANTENDO A LÓGICA ORIGINAL SEGURA
    const now = Date.now();
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`🔍 [CLEANUP] Buscando drafts entre ${sevenDaysAgo} e ${thirtyMinutesAgo}`);

    // Query SEGURA - primeiro buscar documentos básicos
    const { data: draftsToDelete, error: queryError } = await supabase
      .from('documents')
      .select('id, filename, file_url, user_id, created_at')
      .eq('status', 'draft')
      .lt('created_at', thirtyMinutesAgo) // Criado há mais de 30 minutos
      .gt('created_at', sevenDaysAgo); // Criado há menos de 7 dias

    if (queryError) {
      console.error('❌ [CLEANUP] Erro ao buscar drafts:', queryError);
      throw queryError;
    }

    console.log(`📊 [CLEANUP] Encontrados ${draftsToDelete?.length || 0} drafts candidatos para exclusão`);

    if (!draftsToDelete || draftsToDelete.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        checked: 0,
        deleted: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filtrar manualmente sessões Stripe ativas - BUSCAR SEPARADAMENTE
    const safeToDelete = [];
    
    for (const doc of draftsToDelete) {
      // Buscar sessões Stripe para este documento
      const { data: sessions, error: sessionError } = await supabase
        .from('stripe_sessions')
        .select('session_id, payment_status, updated_at')
        .eq('document_id', doc.id);

      if (sessionError) {
        console.error(`⚠️ [CLEANUP] Erro ao buscar sessões para ${doc.id}:`, sessionError);
        continue; // Pular este documento se houver erro
      }

      // Sem sessão Stripe = seguro
      if (!sessions || sessions.length === 0) {
        console.log(`✅ [CLEANUP] Documento ${doc.id} seguro - sem sessão Stripe`);
        safeToDelete.push(doc);
        continue;
      }

      // Se tem sessão, verificar se expirou
      const session = sessions[0];
      const sessionUpdatedAt = new Date(session.updated_at).getTime();
      const oneHourAgo = now - 60 * 60 * 1000;

      // ✅ Sessões marcadas como expired ou failed são seguras para apagar
      if (session.payment_status === 'expired' || session.payment_status === 'failed') {
        console.log(`✅ [CLEANUP] Documento ${doc.id} seguro - sessão ${session.payment_status}`);
        safeToDelete.push(doc);
        continue;
      }

      // Sessão completed = NÃO apagar (já foi pago)
      if (session.payment_status === 'completed') {
        console.log(`⚠️ [CLEANUP] Documento ${doc.id} NÃO seguro - sessão completed`);
        continue;
      }

      // Sessão pending foi atualizada há menos de 1 hora = NÃO APAGAR
      if (sessionUpdatedAt > oneHourAgo) {
        console.log(`⚠️ [CLEANUP] Documento ${doc.id} NÃO seguro - sessão atualizada há menos de 1 hora`);
        continue;
      }

      // Sessão pending com mais de 1 hora = considerar expirada
      if (session.payment_status === 'pending' && sessionUpdatedAt < oneHourAgo) {
        console.log(`✅ [CLEANUP] Documento ${doc.id} seguro - sessão pending inativa há mais de 1 hora`);
        safeToDelete.push(doc);
        continue;
      }

      console.log(`✅ [CLEANUP] Documento ${doc.id} seguro - sessão expirada por tempo`);
      safeToDelete.push(doc);
    }

    console.log(`✅ [CLEANUP] ${safeToDelete.length} documentos seguros para exclusão de ${draftsToDelete.length} candidatos`);

    // Limite de segurança: não apagar mais de 50 documentos por execução
    const toDelete = safeToDelete.slice(0, 50);
    
    if (safeToDelete.length > 50) {
      console.warn(`⚠️ [CLEANUP] Limite de segurança alcançado. Apagando apenas 50 de ${safeToDelete.length} documentos`);
    }

    let deletedCount = 0;
    let storageDeleted = 0;
    let sessionsDeleted = 0;
    const errors = [];

    // Apagar cada documento com log detalhado
    for (const doc of toDelete) {
      try {
        // 1. Apagar arquivo do Storage se existir
        if (doc.file_url) {
          try {
            const urlParts = doc.file_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `${doc.user_id}/${fileName}`;

            const { error: storageError } = await supabase.storage
              .from('documents')
              .remove([filePath]);

            if (storageError) {
              console.error(`⚠️ [CLEANUP] Erro ao remover storage para ${doc.id}:`, storageError);
              errors.push({ doc: doc.id, type: 'storage', error: storageError });
            } else {
              console.log(`🗑️ [CLEANUP] Storage removido: ${filePath}`);
              storageDeleted++;
            }
          } catch (storageException) {
            console.error(`❌ [CLEANUP] Exceção ao remover storage para ${doc.id}:`, storageException);
            errors.push({ doc: doc.id, type: 'storage_exception', error: storageException });
          }
        }

        // 2. Apagar sessões Stripe relacionadas
        if (doc.stripe_sessions && doc.stripe_sessions.length > 0) {
          try {
            const { error: sessionDeleteError } = await supabase
              .from('stripe_sessions')
              .delete()
              .eq('document_id', doc.id);

            if (sessionDeleteError) {
              console.error(`⚠️ [CLEANUP] Erro ao remover sessões Stripe para ${doc.id}:`, sessionDeleteError);
            } else {
              console.log(`🗑️ [CLEANUP] Sessões Stripe removidas para doc ${doc.id}`);
              sessionsDeleted++;
            }
          } catch (sessionException) {
            console.error(`❌ [CLEANUP] Exceção ao remover sessões Stripe para ${doc.id}:`, sessionException);
          }
        }

        // 3. Apagar documento do banco
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id);

        if (deleteError) {
          console.error(`❌ [CLEANUP] Erro ao apagar documento ${doc.id}:`, deleteError);
          errors.push({ doc: doc.id, type: 'delete', error: deleteError });
        } else {
          console.log(`✅ [CLEANUP] Documento draft apagado: ${doc.filename} (${doc.id})`);
          deletedCount++;
        }
      } catch (docError) {
        console.error(`❌ [CLEANUP] Erro geral ao processar documento ${doc.id}:`, docError);
        errors.push({ doc: doc.id, type: 'general', error: docError });
      }
    }

    // Log final
    console.log(`🎯 [CLEANUP] Cleanup concluído:`);
    console.log(`   - Verificados: ${draftsToDelete.length}`);
    console.log(`   - Apagados: ${deletedCount}`);
    console.log(`   - Storage removido: ${storageDeleted}`);
    console.log(`   - Sessões Stripe removidas: ${sessionsDeleted}`);
    console.log(`   - Erros: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      checked: draftsToDelete.length,
      deleted: deletedCount,
      storageDeleted: storageDeleted,
      sessionsDeleted: sessionsDeleted,
      errors: errors.length,
      errorDetails: errors,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Erro fatal:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});