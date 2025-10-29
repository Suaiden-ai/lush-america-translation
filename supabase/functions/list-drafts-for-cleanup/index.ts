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

  console.log(`🔍 [LIST-CLEANUP] Listando documentos draft para possível cleanup - ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('PROJECT_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular timestamps - MANTENDO A LÓGICA SEGURA
    const now = Date.now();
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`🔍 [LIST-CLEANUP] Buscando documentos entre ${sevenDaysAgo} e ${thirtyMinutesAgo}`);

    // Query SEGURA - buscar documentos básicos
    const { data: draftsToReview, error: queryError } = await supabase
      .from('documents')
      .select('id, filename, file_url, user_id, created_at')
      .eq('status', 'draft')
      .lt('created_at', thirtyMinutesAgo) // Criado há mais de 30 minutos
      .gt('created_at', sevenDaysAgo); // Criado há menos de 7 dias

    if (queryError) {
      console.error('❌ [LIST-CLEANUP] Erro na query:', queryError);
      throw queryError;
    }

    console.log(`🔍 [LIST-CLEANUP] Encontrados ${draftsToReview?.length || 0} documentos para análise`);

    if (!draftsToReview || draftsToReview.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum documento draft encontrado para cleanup',
        documents: [],
        total: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Verificar cada documento individualmente para sessões Stripe
    const documentsToCleanup = [];
    const documentsToKeep = [];

    for (const doc of draftsToReview) {
      try {
        // Buscar sessões Stripe para este documento
        const { data: sessions, error: sessionError } = await supabase
          .from('stripe_sessions')
          .select('session_id, payment_status, updated_at')
          .eq('document_id', doc.id);

        if (sessionError) {
          console.error(`⚠️ [LIST-CLEANUP] Erro ao buscar sessões para ${doc.id}:`, sessionError);
          documentsToKeep.push({
            ...doc,
            reason: 'Erro ao verificar sessões Stripe',
            sessions: []
          });
          continue;
        }

        // Verificar se tem pagamento confirmado
        const { data: payments } = await supabase
          .from('payments')
          .select('id')
          .eq('document_id', doc.id);

        // LÓGICA DE SEGURANÇA - só incluir se realmente seguro para apagar
        if (payments && payments.length > 0) {
          documentsToKeep.push({
            ...doc,
            reason: 'Tem pagamento confirmado',
            sessions: sessions || [],
            payments: payments
          });
          continue;
        }

        if (!sessions || sessions.length === 0) {
          // Sem sessão Stripe = seguro para apagar
          documentsToCleanup.push({
            ...doc,
            reason: 'Sem sessão Stripe',
            sessions: [],
            payments: []
          });
          continue;
        }

        // Se tem sessão, verificar se expirou
        const session = sessions[0];
        const sessionUpdatedAt = new Date(session.updated_at).getTime();
        const oneHourAgo = now - 60 * 60 * 1000;

        // Sessões marcadas como expired ou failed são seguras para apagar
        if (session.payment_status === 'expired' || session.payment_status === 'failed') {
          documentsToCleanup.push({
            ...doc,
            reason: `Sessão Stripe ${session.payment_status}`,
            sessions: sessions,
            payments: []
          });
          continue;
        }

        // Sessões pending ou completed - NÃO apagar
        if (session.payment_status === 'pending' || session.payment_status === 'completed') {
          documentsToKeep.push({
            ...doc,
            reason: `Sessão Stripe ${session.payment_status}`,
            sessions: sessions,
            payments: []
          });
          continue;
        }

        // Sessões muito antigas (mais de 1 hora) podem ser seguras
        if (sessionUpdatedAt < oneHourAgo) {
          documentsToCleanup.push({
            ...doc,
            reason: 'Sessão Stripe antiga (mais de 1 hora)',
            sessions: sessions,
            payments: []
          });
        } else {
          documentsToKeep.push({
            ...doc,
            reason: 'Sessão Stripe recente (menos de 1 hora)',
            sessions: sessions,
            payments: []
          });
        }

      } catch (docError) {
        console.error(`❌ [LIST-CLEANUP] Erro ao processar documento ${doc.id}:`, docError);
        documentsToKeep.push({
          ...doc,
          reason: 'Erro no processamento',
          sessions: [],
          payments: []
        });
      }
    }

    console.log(`🔍 [LIST-CLEANUP] Resultado: ${documentsToCleanup.length} para cleanup, ${documentsToKeep.length} para manter`);

    return new Response(JSON.stringify({
      success: true,
      message: `Encontrados ${documentsToCleanup.length} documentos seguros para cleanup`,
      documentsToCleanup,
      documentsToKeep,
      totalToCleanup: documentsToCleanup.length,
      totalToKeep: documentsToKeep.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ [LIST-CLEANUP] Erro geral:', error);
    
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
