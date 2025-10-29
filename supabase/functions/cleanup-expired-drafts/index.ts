import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { getStripeConfig } from '../shared/stripe-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Sincroniza sessões Stripe pending com o status real da API do Stripe
 * Atualiza sessões que expiraram ou foram completadas
 */
async function syncStripeSessions(supabase: any, stripe: Stripe): Promise<{ checked: number, updated: number }> {
  console.log(`🔄 [CLEANUP] Sincronizando sessões Stripe pending...`);
  
  try {
    // Buscar sessões pending que foram atualizadas há mais de 30 minutos
    // (para evitar consultar sessões muito recentes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: pendingSessions, error: queryError } = await supabase
      .from('stripe_sessions')
      .select('id, session_id, payment_status, updated_at')
      .eq('payment_status', 'pending')
      .lt('updated_at', thirtyMinutesAgo);

    if (queryError) {
      console.error('❌ [CLEANUP] Erro ao buscar sessões pending:', queryError);
      return { checked: 0, updated: 0 };
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      console.log('✅ [CLEANUP] Nenhuma sessão pending para sincronizar');
      return { checked: 0, updated: 0 };
    }

    console.log(`🔍 [CLEANUP] Verificando ${pendingSessions.length} sessões pending no Stripe...`);

    let checkedCount = 0;
    let updatedCount = 0;

    // Verificar cada sessão no Stripe (com limite para não sobrecarregar)
    const sessionsToCheck = pendingSessions.slice(0, 50); // Limite de 50 por execução
    
    for (const session of sessionsToCheck) {
      try {
        checkedCount++;

        // Consultar a sessão no Stripe
        const stripeSession = await stripe.checkout.sessions.retrieve(session.session_id);

        // Verificar se o status mudou
        let newStatus = session.payment_status;
        let shouldUpdate = false;

        if (stripeSession.status === 'expired') {
          newStatus = 'expired';
          shouldUpdate = true;
          console.log(`✅ [CLEANUP] Sessão ${session.session_id} expirada no Stripe`);
        } else if (stripeSession.status === 'complete' && stripeSession.payment_status === 'paid') {
          newStatus = 'completed';
          shouldUpdate = true;
          console.log(`✅ [CLEANUP] Sessão ${session.session_id} completada no Stripe`);
        } else if (stripeSession.status === 'open') {
          // Verificar se expirou por tempo (Stripe expira após 24h)
          const expiresAt = stripeSession.expires_at ? new Date(stripeSession.expires_at * 1000) : null;
          if (expiresAt && expiresAt < new Date()) {
            newStatus = 'expired';
            shouldUpdate = true;
            console.log(`✅ [CLEANUP] Sessão ${session.session_id} expirada por tempo`);
          }
        }

        // Atualizar o banco se necessário
        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from('stripe_sessions')
            .update({
              payment_status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`❌ [CLEANUP] Erro ao atualizar sessão ${session.session_id}:`, updateError);
          } else {
            updatedCount++;
          }
        }

        // Pequeno delay para não sobrecarregar a API do Stripe
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (sessionError: any) {
        console.error(`❌ [CLEANUP] Erro ao verificar sessão ${session.session_id}:`, sessionError.message);
      }
    }

    console.log(`✅ [CLEANUP] Sincronização concluída: ${checkedCount} verificadas, ${updatedCount} atualizadas`);
    return { checked: checkedCount, updated: updatedCount };

  } catch (error: any) {
    console.error('❌ [CLEANUP] Erro na sincronização de sessões Stripe:', error.message);
    return { checked: 0, updated: 0 };
  }
}

Deno.serve(async (req) => {
  console.log(`🧹 [CLEANUP] Iniciando cleanup automático de drafts expirados - ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('PROJECT_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 🔄 NOVO: Sincronizar sessões Stripe antes de processar documentos
    let syncResult = { checked: 0, updated: 0 };
    try {
      const stripeConfig = getStripeConfig(req);
      const stripe = new Stripe(stripeConfig.secretKey, {
        apiVersion: stripeConfig.apiVersion as any,
        appInfo: stripeConfig.appInfo,
      });
      syncResult = await syncStripeSessions(supabase, stripe);
    } catch (stripeError: any) {
      console.warn(`⚠️ [CLEANUP] Erro ao configurar Stripe, continuando sem sincronização:`, stripeError.message);
      // Continua mesmo se não conseguir sincronizar (não é crítico)
    }

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
        // Sempre tentar deletar sessões (não verificar se existem, pois já verificamos antes)
        try {
          const { error: sessionDeleteError, data: deletedSessions } = await supabase
            .from('stripe_sessions')
            .delete()
            .eq('document_id', doc.id)
            .select(); // Usar select para saber se algo foi deletado

          if (sessionDeleteError) {
            console.error(`⚠️ [CLEANUP] Erro ao remover sessões Stripe para ${doc.id}:`, sessionDeleteError);
            errors.push({ doc: doc.id, type: 'sessions', error: sessionDeleteError });
          } else if (deletedSessions && deletedSessions.length > 0) {
            console.log(`🗑️ [CLEANUP] ${deletedSessions.length} sessão(ões) Stripe removida(s) para doc ${doc.id}`);
            sessionsDeleted += deletedSessions.length;
          }
        } catch (sessionException) {
          console.error(`❌ [CLEANUP] Exceção ao remover sessões Stripe para ${doc.id}:`, sessionException);
          errors.push({ doc: doc.id, type: 'sessions_exception', error: sessionException });
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
    console.log(`   - Sessões Stripe sincronizadas: ${syncResult.checked} verificadas, ${syncResult.updated} atualizadas`);
    console.log(`   - Documentos verificados: ${draftsToDelete.length}`);
    console.log(`   - Documentos apagados: ${deletedCount}`);
    console.log(`   - Storage removido: ${storageDeleted}`);
    console.log(`   - Sessões Stripe removidas: ${sessionsDeleted}`);
    console.log(`   - Erros: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      stripeSync: {
        checked: syncResult.checked,
        updated: syncResult.updated
      },
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