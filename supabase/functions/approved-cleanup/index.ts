import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`🗑️ [APPROVED-CLEANUP] Iniciando cleanup de documentos aprovados - ${new Date().toISOString()}`);

  try {
    const { documentIds } = await req.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lista de IDs de documentos é obrigatória',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('PROJECT_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let deletedCount = 0;
    let storageDeletedCount = 0;
    let sessionsDeletedCount = 0;
    const errors = [];

    console.log(`🗑️ [APPROVED-CLEANUP] Processando ${documentIds.length} documentos aprovados`);

    for (const documentId of documentIds) {
      try {
        console.log(`🗑️ [APPROVED-CLEANUP] Processando documento ${documentId}`);

        // 1. Buscar informações do documento antes de apagar
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('id, filename, file_url, user_id')
          .eq('id', documentId)
          .eq('status', 'draft')
          .single();

        if (docError || !doc) {
          console.error(`⚠️ [APPROVED-CLEANUP] Documento ${documentId} não encontrado ou não é draft:`, docError);
          errors.push({ documentId, error: 'Documento não encontrado ou não é draft' });
          continue;
        }

        // 2. Apagar arquivo do storage
        if (doc.file_url) {
          try {
            const filePath = doc.file_url.split('/storage/v1/object/public/')[1];
            const { error: storageError } = await supabase.storage
              .from('documents')
              .remove([filePath]);

            if (storageError) {
              console.error(`⚠️ [APPROVED-CLEANUP] Erro ao remover arquivo do storage para ${documentId}:`, storageError);
            } else {
              console.log(`🗑️ [APPROVED-CLEANUP] Arquivo removido do storage para doc ${documentId}`);
              storageDeletedCount++;
            }
          } catch (storageException) {
            console.error(`❌ [APPROVED-CLEANUP] Exceção ao remover arquivo do storage para ${documentId}:`, storageException);
          }
        }

        // 3. Apagar sessões Stripe relacionadas
        try {
          const { error: sessionDeleteError } = await supabase
            .from('stripe_sessions')
            .delete()
            .eq('document_id', documentId);

          if (sessionDeleteError) {
            console.error(`⚠️ [APPROVED-CLEANUP] Erro ao remover sessões Stripe para ${documentId}:`, sessionDeleteError);
          } else {
            console.log(`🗑️ [APPROVED-CLEANUP] Sessões Stripe removidas para doc ${documentId}`);
            sessionsDeletedCount++;
          }
        } catch (sessionException) {
          console.error(`❌ [APPROVED-CLEANUP] Exceção ao remover sessões Stripe para ${documentId}:`, sessionException);
        }

        // 4. Apagar documento do banco
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .eq('id', documentId);

        if (deleteError) {
          console.error(`❌ [APPROVED-CLEANUP] Erro ao remover documento ${documentId}:`, deleteError);
          errors.push({ documentId, error: deleteError.message });
        } else {
          console.log(`✅ [APPROVED-CLEANUP] Documento ${documentId} (${doc.filename}) removido com sucesso`);
          deletedCount++;
        }

      } catch (docException) {
        console.error(`❌ [APPROVED-CLEANUP] Exceção ao processar documento ${documentId}:`, docException);
        errors.push({ documentId, error: docException.message });
      }
    }

    console.log(`🗑️ [APPROVED-CLEANUP] Concluído: ${deletedCount} documentos removidos, ${errors.length} erros`);

    return new Response(JSON.stringify({
      success: true,
      message: `Cleanup concluído: ${deletedCount} documentos removidos`,
      deleted: deletedCount,
      storageDeleted: storageDeletedCount,
      sessionsDeleted: sessionsDeletedCount,
      errors: errors.length,
      errorDetails: errors,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ [APPROVED-CLEANUP] Erro geral:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
