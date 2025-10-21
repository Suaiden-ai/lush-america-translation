import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getStripeConfig } from '../shared/stripe-config.ts';
import { getAllWebhookSecrets } from '../shared/environment-detector.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verifies Stripe webhook signature
 * 
 * @param body - Raw request body
 * @param signature - Stripe signature header
 * @param secret - Webhook secret to verify against
 * @returns Promise<boolean> - True if signature is valid
 */
async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const stripe = new (await import('https://esm.sh/stripe@14.21.0')).default(secret, {
      apiVersion: '2024-12-18.acacia',
    });
    
    await stripe.webhooks.constructEventAsync(body, signature, secret);
    return true;
  } catch (error) {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  console.log(`[${new Date().toISOString()}] Webhook Stripe chamado`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar método HTTP
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Obter o corpo da requisição
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      throw new Error('Stripe signature missing');
    }

    // ✅ NOVA ABORDAGEM: Verificação multi-secret
    const allSecrets = getAllWebhookSecrets();
    let validConfig = null;
    let isValid = false;
    
    console.log(`[stripe-webhook] Tentando verificar assinatura com ${allSecrets.length} secrets disponíveis...`);
    
    for (const { env, secret } of allSecrets) {
      console.log(`[stripe-webhook] Tentando ambiente: ${env}`);
      isValid = await verifyStripeSignature(body, signature, secret);
      if (isValid) {
        console.log(`✅ Assinatura verificada com sucesso usando ambiente: ${env}`);
        validConfig = { environment: env, secret };
        break;
      } else {
        console.log(`❌ Falha na verificação com ambiente: ${env}`);
      }
    }
    
    if (!isValid || !validConfig) {
      console.error('❌ Webhook signature verification failed with all available secrets');
      throw new Error('Webhook signature verification failed');
    }

    // Obter configuração do Stripe baseada no ambiente detectado
    const stripeConfig = getStripeConfig(req);
    
    // Log adicional para debug
    console.log('🔧 Using Stripe in', validConfig.environment, 'mode');
    
    // Obter variáveis do Supabase
    const supabaseUrl = Deno.env.get('PROJECT_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not configured');
    }

    // Importar Stripe dinamicamente com configuração dinâmica
    const stripe = new (await import('https://esm.sh/stripe@14.21.0')).default(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion,
    });

    console.log(`🔧 Using Stripe in ${validConfig.environment} mode`);

    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar assinatura do webhook (já verificada acima)
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, validConfig.secret);
      console.log('✅ Evento processado com sucesso');
    } catch (err) {
      console.error('❌ Erro ao processar evento:', err.message);
      throw new Error('Failed to process webhook event');
    }

    console.log('DEBUG: Webhook event received:', event.type);
    console.log('DEBUG: Event data:', JSON.stringify(event.data.object, null, 2));

    // Processar eventos específicos
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, supabase);
        break;
      
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object.id);
        break;
      
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object.id);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
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

async function handleCheckoutSessionCompleted(session: any, supabase: any) {
  console.log('DEBUG: Processando checkout session completed:', session.id);
  console.log('DEBUG: Sessão completa:', JSON.stringify(session, null, 2));
  
  try {
    const {
      fileId,
      userId,
      filename,
      pages,
      isCertified,
      isNotarized,
      isBankStatement,
      totalPrice,
      documentId
    } = session.metadata;

    console.log('DEBUG: Metadados da sessão:', {
      fileId, userId, filename, pages, isCertified, isNotarized, isBankStatement, totalPrice, documentId
    });

    if (!documentId) {
      console.log('WARNING: documentId não encontrado nos metadados, pulando processamento');
      return;
    }

    if (!userId) {
      console.log('WARNING: userId não encontrado nos metadados, pulando processamento');
      return;
    }

    // Atualizar o documento existente com status processing
    console.log('DEBUG: Atualizando documento existente para status processing');
    
    const { data: updatedDocument, error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('ERROR: Erro ao atualizar documento:', updateError);
      throw new Error('Failed to update document');
    }

    console.log('DEBUG: Documento atualizado com sucesso:', updatedDocument);

    // Atualizar o status da sessão na tabela stripe_sessions
    try {
      console.log('DEBUG: Atualizando stripe_sessions para completed');
      
      const { error: sessionUpdateError } = await supabase
        .from('stripe_sessions')
        .update({
          payment_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('session_id', session.id);

      if (sessionUpdateError) {
        console.error('WARNING: Erro ao atualizar stripe_sessions:', sessionUpdateError);
        // Não falhar se isso der erro, apenas log
      } else {
        console.log('DEBUG: stripe_sessions atualizado com sucesso para completed');
      }
    } catch (sessionError) {
      console.log('WARNING: Erro ao atualizar stripe_sessions:', sessionError);
      // Não falhar se isso der erro
    }

    // Criar registro na tabela payments
    try {
      console.log('DEBUG: Criando registro na tabela payments');
      
      const paymentData = {
        document_id: documentId,
        user_id: userId,
        stripe_session_id: session.id,
        amount: parseFloat(totalPrice || '0'),
        currency: 'USD',
        status: 'completed',
        payment_method: 'card',
        payment_date: new Date().toISOString()
      };

      console.log('DEBUG: Dados do pagamento a serem inseridos:', paymentData);
      
      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (paymentError) {
        console.error('ERROR: Erro ao criar registro na tabela payments:', paymentError);
        console.error('DEBUG: Detalhes do erro:', JSON.stringify(paymentError, null, 2));
        throw new Error('Failed to create payment record');
      } else {
        console.log('DEBUG: Registro criado na tabela payments com sucesso:', paymentRecord.id);
      }
      
      // Enviar notificação de pagamento para admins
      try {
        console.log('DEBUG: Enviando notificação de pagamento Stripe para admins');
        
        // Buscar dados do usuário que fez o pagamento
        const { data: user, error: userError } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', userId)
          .single();
        
        // Buscar emails dos admins
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email')
          .in('role', ['admin', 'finance', 'lush-admin']);

        if (!userError && user && adminProfiles && adminProfiles.length > 0) {
          // Enviar notificação para cada admin
          for (const admin of adminProfiles) {
            const notificationPayload = {
              user_name: user.name || 'Unknown User',
              user_email: admin.email,
              notification_type: 'Payment Stripe',
              timestamp: new Date().toISOString(),
              filename: filename || 'Unknown Document',
              document_id: documentId,
              status: 'pagamento aprovado automaticamente'
            };
            
            try {
              const webhookResponse = await fetch('https://nwh.thefutureofenglish.com/webhook/notthelush1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationPayload)
              });
              
              if (webhookResponse.ok) {
                console.log(`SUCCESS: Notificação Stripe enviada para admin: ${admin.email}`);
              } else {
                console.error(`WARNING: Falha ao enviar notificação Stripe para ${admin.email}:`, webhookResponse.status);
              }
            } catch (adminNotificationError) {
              console.error(`ERROR: Erro ao enviar notificação para admin ${admin.email}:`, adminNotificationError);
            }
          }
        }
      } catch (notificationError) {
        console.error('WARNING: Erro ao enviar notificações de pagamento Stripe:', notificationError);
        // Não falhar o processo por causa da notificação
      }
      
      // Notificar autenticadores sobre documento pendente (Stripe = aprovação automática)
      try {
        console.log('DEBUG: Enviando notificação para autenticadores sobre documento pendente');
        
        // Buscar todos os autenticadores
        const { data: authenticators, error: authError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('role', 'authenticator');

        if (!authError && authenticators && authenticators.length > 0) {
          // Buscar dados do usuário que fez o pagamento
          const { data: user } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', userId)
            .single();

          // Enviar notificação para cada autenticador
          for (const authenticator of authenticators) {
            const authNotificationPayload = {
              user_name: authenticator.name || authenticator.email || 'Authenticator',
              user_email: authenticator.email,
              notification_type: 'Authenticator Pending Documents Notification',
              timestamp: new Date().toISOString(),
              filename: filename || 'Unknown Document',
              document_id: documentId,
              status: 'pending_authentication',
              client_name: user?.name || 'Unknown Client',
              client_email: user?.email || 'unknown@email.com'
            };
            
            try {
              const authWebhookResponse = await fetch('https://nwh.thefutureofenglish.com/webhook/notthelush1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authNotificationPayload)
              });
              
              if (authWebhookResponse.ok) {
                console.log(`SUCCESS: Notificação para autenticador enviada: ${authenticator.email}`);
              } else {
                console.error(`WARNING: Falha ao enviar notificação para autenticador ${authenticator.email}:`, authWebhookResponse.status);
              }
            } catch (authNotificationError) {
              console.error(`ERROR: Erro ao enviar notificação para autenticador ${authenticator.email}:`, authNotificationError);
            }
          }
          
          console.log(`SUCCESS: Notificações enviadas para ${authenticators.length} autenticadores`);
        } else {
          console.log('INFO: Nenhum autenticador encontrado para notificar');
        }
      } catch (authNotificationError) {
        console.error('WARNING: Erro ao enviar notificações para autenticadores:', authNotificationError);
        // Não falhar o processo por causa da notificação
      }
      
    } catch (paymentError) {
      console.error('ERROR: Erro ao criar registro na tabela payments:', paymentError);
      throw paymentError;
    }

    // Log do pagamento bem-sucedido
    console.log('SUCCESS: Pagamento processado com sucesso para documento:', documentId);
    console.log('SUCCESS: Documento atualizado para status processing.');
    console.log('SUCCESS: Registro criado na tabela payments.');
    console.log('SUCCESS: stripe_sessions atualizado para completed.');

  } catch (error) {
    console.error('ERROR: Erro ao processar checkout session:', error);
    console.error('DEBUG: Stack trace:', error.stack);
    throw error;
  }
} 