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
async function syncStripeSessions(supabase: any, stripe: Stripe, stripeConfig: any): Promise<{ checked: number, updated: number }> {
  console.log(`🔄 [LIST-CLEANUP] Sincronizando sessões Stripe pending...`);
  
  try {
    // Buscar sessões pending que foram atualizadas há mais de 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: pendingSessions, error: queryError } = await supabase
      .from('stripe_sessions')
      .select('id, session_id, payment_status, updated_at')
      .eq('payment_status', 'pending')
      .lt('updated_at', thirtyMinutesAgo);

    if (queryError) {
      console.error('❌ [LIST-CLEANUP] Erro ao buscar sessões pending:', queryError);
      return { checked: 0, updated: 0 };
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      console.log('✅ [LIST-CLEANUP] Nenhuma sessão pending para sincronizar');
      return { checked: 0, updated: 0 };
    }

    console.log(`🔍 [LIST-CLEANUP] Verificando ${pendingSessions.length} sessões pending no Stripe...`);

    let checkedCount = 0;
    let updatedCount = 0;

    // Verificar cada sessão no Stripe (com limite para não sobrecarregar)
    const sessionsToCheck = pendingSessions.slice(0, 50); // Limite de 50 por execução
    
    for (const session of sessionsToCheck) {
      try {
        checkedCount++;

        // Verificar se a sessão é de produção (cs_live_) mas estamos em ambiente de teste
        // Neste caso, não podemos verificar com as chaves de teste, então pulamos
        const isLiveSession = session.session_id.startsWith('cs_live_');
        const isTestEnvironment = stripeConfig.environment.environment === 'test';
        
        if (isLiveSession && isTestEnvironment) {
          // Sessão de produção não pode ser verificada em ambiente de teste
          // Não fazer nada - deixar para verificar em produção
          console.log(`⚠️ [LIST-CLEANUP] Sessão ${session.session_id} (live) ignorada - ambiente test não pode verificar sessões de produção`);
          continue;
        }

        // Consultar a sessão no Stripe
        const stripeSession = await stripe.checkout.sessions.retrieve(session.session_id);

        // Verificar se o status mudou
        let newStatus = session.payment_status;
        let shouldUpdate = false;

        if (stripeSession.status === 'expired') {
          newStatus = 'expired';
          shouldUpdate = true;
          console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} expirada no Stripe`);
        } else if (stripeSession.status === 'complete' && stripeSession.payment_status === 'paid') {
          newStatus = 'completed';
          shouldUpdate = true;
          console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} completada no Stripe`);
        } else if (stripeSession.status === 'open') {
          // Verificar se expirou por tempo (Stripe expira após 24h)
          const expiresAt = stripeSession.expires_at ? new Date(stripeSession.expires_at * 1000) : null;
          if (expiresAt && expiresAt < new Date()) {
            newStatus = 'expired';
            shouldUpdate = true;
            console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} expirada por tempo`);
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
            console.error(`❌ [LIST-CLEANUP] Erro ao atualizar sessão ${session.session_id}:`, updateError);
          } else {
            updatedCount++;
          }
        }

        // Pequeno delay para não sobrecarregar a API do Stripe
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (sessionError: any) {
        // Se o erro for "No such checkout.session", verificar se é realmente um erro ou incompatibilidade de ambiente
        if (sessionError.message && sessionError.message.includes('No such checkout.session')) {
          const isLiveSession = session.session_id.startsWith('cs_live_');
          const isTestEnvironment = stripeConfig.environment.environment === 'test';
          
          // Se for sessão de produção em ambiente de teste, apenas pular (não podemos verificar)
          if (isLiveSession && isTestEnvironment) {
            console.log(`⚠️ [LIST-CLEANUP] Sessão ${session.session_id} (live) não pode ser verificada em ambiente test - ignorando`);
            continue;
          }
          
          // Se for sessão de teste e não existe, marcar como expirada (sessão realmente não existe)
          console.log(`⚠️ [LIST-CLEANUP] Sessão ${session.session_id} não encontrada no Stripe, marcando como expirada`);
          
          const { error: updateError } = await supabase
            .from('stripe_sessions')
            .update({
              payment_status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (!updateError) {
            updatedCount++;
            console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} marcada como expirada`);
          }
        } else {
          console.error(`❌ [LIST-CLEANUP] Erro ao verificar sessão ${session.session_id}:`, sessionError.message);
        }
      }
    }

    console.log(`✅ [LIST-CLEANUP] Sincronização concluída: ${checkedCount} verificadas, ${updatedCount} atualizadas`);
    return { checked: checkedCount, updated: updatedCount };

  } catch (error: any) {
    console.error('❌ [LIST-CLEANUP] Erro na sincronização de sessões Stripe:', error.message);
    return { checked: 0, updated: 0 };
  }
}

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

    // 🔄 NOVO: Sincronizar sessões Stripe antes de listar documentos
    let syncResult = { checked: 0, updated: 0 };
    try {
      const stripeConfig = getStripeConfig(req);
      const stripe = new Stripe(stripeConfig.secretKey, {
        apiVersion: stripeConfig.apiVersion as any,
        appInfo: stripeConfig.appInfo,
      });
      syncResult = await syncStripeSessions(supabase, stripe, stripeConfig);
    } catch (stripeError: any) {
      console.warn(`⚠️ [LIST-CLEANUP] Erro ao configurar Stripe, continuando sem sincronização:`, stripeError.message);
      // Continua mesmo se não conseguir sincronizar (não é crítico)
    }

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
      stripeSync: {
        checked: syncResult.checked,
        updated: syncResult.updated
      },
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
