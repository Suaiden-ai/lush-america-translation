import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getStripeConfig } from '../shared/stripe-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar método HTTP
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Obter dados do corpo da requisição
    const { sessionId } = await req.json();

    console.log('DEBUG: Buscando informações da sessão:', sessionId);

    // Validações
    if (!sessionId) {
      throw new Error('Session ID é obrigatório');
    }

    // Obter configuração do Stripe baseada no ambiente detectado
    const stripeConfig = getStripeConfig(req);

    // Importar Stripe dinamicamente com configuração dinâmica
    const stripe = new (await import('https://esm.sh/stripe@14.21.0')).default(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion,
    });

    console.log(`🔧 Using Stripe in ${stripeConfig.environment.environment} mode`);

    // Buscar informações da sessão
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log('DEBUG: Sessão encontrada:', session.id);

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        metadata: session.metadata,
        paymentStatus: session.payment_status,
        status: session.status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('ERROR:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}); 