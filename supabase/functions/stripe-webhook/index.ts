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
  console.log(`🔍 [WEBHOOK DEBUG] [${new Date().toISOString()}] Webhook Stripe chamado`);
  console.log(`🔍 [WEBHOOK DEBUG] Method: ${req.method}`);
  console.log(`🔍 [WEBHOOK DEBUG] URL: ${req.url}`);
  console.log(`🔍 [WEBHOOK DEBUG] Headers:`, Object.fromEntries(req.headers.entries()));
  
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

    console.log('🔍 [WEBHOOK DEBUG] Webhook event received:', event.type);
    console.log('🔍 [WEBHOOK DEBUG] Event data:', JSON.stringify(event.data.object, null, 2));
    console.log('🔍 [WEBHOOK DEBUG] Event ID:', event.id);
    console.log('🔍 [WEBHOOK DEBUG] Event created:', event.created);

    // Processar eventos específicos
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, supabase);
        break;
      
      case 'checkout.session.async_payment_processing':
        await handleAsyncPaymentProcessing(event.data.object, supabase);
        break;
      
      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object, supabase);
        break;
      
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object.id);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object, supabase);
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

async function handleAsyncPaymentProcessing(session: any, supabase: any) {
  console.log('🔍 [WEBHOOK DEBUG] Processando async payment processing:', session.id);
  
  try {
    // Log de tentativa de pagamento
    if (session.metadata?.userId) {
      const { error: processingLogError } = await supabase
        .from('action_logs')
        .insert({
          performed_by: null,
          performed_by_type: 'system',
          performed_by_name: 'System',
          performed_by_email: 'system@lushamerica.com',
          action_type: 'PAYMENT_PROCESSING',
          action_description: `Payment processing started for checkout session`,
          entity_type: 'payment',
          entity_id: session.metadata.userId,
          metadata: {
            session_id: session.id,
            payment_intent: session.payment_intent,
            amount_total: session.amount_total,
            currency: session.currency,
            customer_email: session.customer_email,
            document_id: session.metadata.documentId,
            filename: session.metadata.filename,
            timestamp: new Date().toISOString()
          },
          affected_user_id: session.metadata.userId
        });
      
      if (processingLogError) {
        console.error('Error logging payment processing:', processingLogError);
      } else {
        console.log('✅ Payment processing logged successfully');
      }
    }
  } catch (error) {
    console.error('Error in handleAsyncPaymentProcessing:', error);
  }
}

async function handleCheckoutSessionCompleted(session: any, supabase: any) {
  console.log('🔍 [WEBHOOK DEBUG] Processando checkout session completed:', session.id);
  console.log('🔍 [WEBHOOK DEBUG] Sessão completa:', JSON.stringify(session, null, 2));
  
  try {
    // ✅ VALIDAÇÃO CRÍTICA: Verificar se pagamento foi realmente aprovado
    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      console.log('⚠️ [WEBHOOK WARNING] Pagamento não foi aprovado.');
      console.log('⚠️ payment_status:', session.payment_status);
      console.log('⚠️ status:', session.status);
      console.log('⚠️ Session ID:', session.id);
      console.log('⚠️ NÃO processando documento.');
      
      // Log de falha no pagamento
      if (session.metadata?.userId) {
        try {
          const { error: insertError } = await supabase
            .from('action_logs')
            .insert({
              performed_by: null,
              performed_by_type: 'system',
              performed_by_name: 'System',
              performed_by_email: 'system@lushamerica.com',
              action_type: 'payment_failed',
              action_description: `Stripe payment not approved (status: ${session.payment_status})`,
              entity_type: 'payment',
              entity_id: session.metadata.userId, // Usar userId dinâmico do usuário
              metadata: {
                session_id: session.id,
                payment_status: session.payment_status,
                status: session.status,
                amount_total: session.amount_total,
                currency: session.currency,
                timestamp: new Date().toISOString()
              },
              affected_user_id: session.metadata.userId
            });
          
          if (insertError) {
            console.error('Error inserting payment failure log:', insertError);
          } else {
            console.log('✅ Payment failure logged successfully');
          }
        } catch (logError) {
          console.error('Error logging payment failure:', logError);
        }
      }
      
      return;
    }

    console.log('✅ [WEBHOOK DEBUG] Pagamento confirmado. Processando documento...');
    
    // Log de pagamento bem-sucedido
    if (session.metadata?.userId) {
      try {
        const { error: insertError } = await supabase
          .from('action_logs')
          .insert({
            performed_by: null,
            performed_by_type: 'system',
            performed_by_name: 'System',
            performed_by_email: 'system@lushamerica.com',
            action_type: 'payment_received',
            action_description: `Stripe payment completed successfully`,
            entity_type: 'payment',
            entity_id: session.metadata.userId, // Usar userId dinâmico do usuário que pagou
            metadata: {
              session_id: session.id,
              payment_intent: session.payment_intent,
              document_id: session.metadata.documentId,
              amount_total: session.amount_total,
              base_amount: session.metadata.base_amount,
              gross_amount: session.metadata.gross_amount,
              fee_amount: session.metadata.fee_amount,
              markup_enabled: session.metadata.markup_enabled,
              currency: session.currency,
              customer_email: session.customer_email,
              document_filename: session.metadata.filename,
              timestamp: new Date().toISOString()
            },
            affected_user_id: session.metadata.userId
          });
        
        if (insertError) {
          console.error('Error inserting payment success log:', insertError);
        } else {
          console.log('✅ Payment success logged successfully');
        }
      } catch (logError) {
        console.error('Error logging payment success:', logError);
      }
    }

    const {
      fileId,
      userId,
      filename,
      pages,
      isCertified,
      isNotarized,
      isBankStatement,
      totalPrice,
      base_amount,
      gross_amount,
      fee_amount,
      markup_enabled,
      documentId
    } = session.metadata;

    console.log('🔍 [WEBHOOK DEBUG] Metadados da sessão:', {
      fileId, userId, filename, pages, isCertified, isNotarized, isBankStatement, 
      totalPrice, base_amount, gross_amount, fee_amount, markup_enabled, documentId
    });

    // 🔍 DEBUG: Verificar se é um documento de autenticador
    console.log('🔍 [WEBHOOK DEBUG] Verificando se é documento de autenticador...');
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('role, name, email')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.log('🔍 [WEBHOOK DEBUG] Erro ao buscar perfil do usuário:', userError);
    } else {
      console.log('🔍 [WEBHOOK DEBUG] Perfil do usuário:', userProfile);
      console.log('🔍 [WEBHOOK DEBUG] Role do usuário:', userProfile?.role);
      console.log('🔍 [WEBHOOK DEBUG] É autenticador?', userProfile?.role === 'authenticator');
    }

    if (!documentId) {
      console.log('WARNING: documentId não encontrado nos metadados, pulando processamento');
      return;
    }

    if (!userId) {
      console.log('WARNING: userId não encontrado nos metadados, pulando processamento');
      return;
    }

    // 🔍 DEBUG: Verificar status atual do documento antes de alterar
    console.log('🔍 [WEBHOOK DEBUG] Verificando status atual do documento...');
    const { data: currentDocument, error: currentError } = await supabase
      .from('documents')
      .select('id, filename, status, user_id, created_at, updated_at')
      .eq('id', documentId)
      .single();
    
    if (currentError) {
      console.log('🔍 [WEBHOOK DEBUG] Erro ao buscar documento atual:', currentError);
    } else {
      console.log('🔍 [WEBHOOK DEBUG] Documento atual encontrado:', currentDocument);
      console.log('🔍 [WEBHOOK DEBUG] Status atual:', currentDocument?.status);
      console.log('🔍 [WEBHOOK DEBUG] Vai alterar de', currentDocument?.status, 'para pending');
    }

    // Atualizar o documento existente com status pending
    console.log('🔍 [WEBHOOK DEBUG] Atualizando documento existente para status pending');
    
    const { data: updatedDocument, error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'pending',
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

    // Log de mudança de status do documento
    try {
      const { error: statusLogError } = await supabase
        .from('action_logs')
        .insert({
          performed_by: null,
          performed_by_type: 'system',
          performed_by_name: 'System',
          performed_by_email: 'system@lushamerica.com',
          action_type: 'DOCUMENT_STATUS_CHANGED',
          action_description: `Document status changed from draft to pending after payment`,
          entity_type: 'document',
          entity_id: documentId,
          metadata: {
            document_id: documentId,
            filename: currentDocument?.filename,
            previous_status: 'draft',
            new_status: 'pending',
            user_id: userId,
            stripe_session_id: session.id,
            payment_intent: session.payment_intent,
            change_reason: 'payment_completed',
            timestamp: new Date().toISOString()
          },
          affected_user_id: userId
        });
      
      if (statusLogError) {
        console.error('Error logging document status change:', statusLogError);
      } else {
        console.log('✅ Document status change logged successfully');
      }
    } catch (logError) {
      console.error('Error logging document status change:', logError);
    }

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
      
      // Usar base_amount (valor líquido) como receita, mas manter gross_amount e fee_amount para rastreamento
      // Se base_amount não estiver disponível, usar totalPrice como fallback
      const baseAmount = base_amount ? parseFloat(base_amount) : (totalPrice ? parseFloat(totalPrice) : 0);
      const grossAmount = gross_amount ? parseFloat(gross_amount) : (totalPrice ? parseFloat(totalPrice) : 0);
      const feeAmount = fee_amount ? parseFloat(fee_amount) : 0;
      
      console.log('🔍 [WEBHOOK DEBUG] Valores de pagamento:', {
        base_amount: baseAmount,
        gross_amount: grossAmount,
        fee_amount: feeAmount,
        markup_enabled: markup_enabled === 'true'
      });
      
      const paymentData = {
        document_id: documentId,
        user_id: userId,
        stripe_session_id: session.id,
        amount: baseAmount, // Valor líquido (receita real)
        base_amount: baseAmount, // Valor base (líquido desejado)
        gross_amount: grossAmount, // Valor bruto cobrado
        fee_amount: feeAmount, // Taxa do Stripe paga pelo usuário
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

async function handleCheckoutSessionExpired(session: any, supabase: any) {
  console.log('🔍 [WEBHOOK DEBUG] Processando checkout session expired:', session.id);
  
  try {
    // Atualizar o status da sessão para expirado
    const { error: sessionUpdateError } = await supabase
      .from('stripe_sessions')
      .update({
        payment_status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('session_id', session.id);

    if (sessionUpdateError) {
      console.error('WARNING: Erro ao atualizar stripe_sessions para expired:', sessionUpdateError);
    } else {
      console.log('✅ Sessão marcada como expirada na stripe_sessions');
    }

    // Log de sessão expirada - verificar se já existe log recente para evitar duplicação
    if (session.metadata?.userId) {
      try {
        // Verificar se já existe um log de cancelamento recente (últimos 5 minutos)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        const { data: existingLogs, error: checkError } = await supabase
          .from('action_logs')
          .select('id, created_at')
          .eq('action_type', 'payment_cancelled')
          .eq('affected_user_id', session.metadata.userId)
          .gte('created_at', fiveMinutesAgo)
          .limit(1);
        
        if (checkError) {
          console.error('Error checking existing cancellation logs:', checkError);
        } else if (existingLogs && existingLogs.length > 0) {
          console.log('⚠️ Skipping duplicate cancellation log - recent log already exists:', existingLogs[0].id);
          return; // Não inserir log duplicado
        }
        
        const { error: insertError } = await supabase
          .from('action_logs')
          .insert({
            performed_by: null,
            performed_by_type: 'system',
            performed_by_name: 'System',
            performed_by_email: 'system@lushamerica.com',
            action_type: 'payment_cancelled',
            action_description: `Stripe checkout session expired`,
            entity_type: 'payment',
            entity_id: session.metadata.userId, // Usar userId dinâmico do usuário
            metadata: {
              session_id: session.id,
              amount_total: session.amount_total,
              currency: session.currency,
              reason: 'session_expired',
              timestamp: new Date().toISOString()
            },
            affected_user_id: session.metadata.userId
          });
        
        if (insertError) {
          console.error('Error inserting session expiration log:', insertError);
        } else {
          console.log('✅ Session expiration logged successfully');
        }
      } catch (logError) {
        console.error('Error logging session expiration:', logError);
      }
    }

  } catch (error) {
    console.error('ERROR: Erro ao processar session expired:', error);
  }
}

async function handlePaymentFailed(paymentIntent: any, supabase: any) {
  console.log('🔍 [WEBHOOK DEBUG] Processando payment intent failed:', paymentIntent.id);
  
  try {
    // Buscar a sessão associada pelo payment_intent_id
    const { data: sessionData, error: sessionError } = await supabase
      .from('stripe_sessions')
      .select('*')
      .eq('session_id', paymentIntent.id)
      .single();

    // Se não encontrar diretamente, pode estar em outro formato
    if (sessionError || !sessionData) {
      // Tentar buscar pelo ID do payment intent
      const { data: allSessions } = await supabase
        .from('stripe_sessions')
        .select('*');
      
      console.log('🔍 Total de sessões no banco:', allSessions?.length || 0);
    }

    // Atualizar sessões relacionadas para failed
    if (sessionData) {
      const { error: updateError } = await supabase
        .from('stripe_sessions')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionData.session_id);

      if (updateError) {
        console.error('WARNING: Erro ao atualizar stripe_sessions para failed:', updateError);
      } else {
        console.log('✅ Sessão marcada como failed na stripe_sessions');
      }

      // Log de falha no pagamento
      if (sessionData.user_id) {
        try {
          const { error: insertError } = await supabase
            .from('action_logs')
            .insert({
              performed_by: null,
              performed_by_type: 'system',
              performed_by_name: 'System',
              performed_by_email: 'system@lushamerica.com',
              action_type: 'payment_failed',
              action_description: `Stripe payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
              entity_type: 'payment',
              entity_id: sessionData.user_id, // Usar userId dinâmico do usuário
              metadata: {
                payment_intent_id: paymentIntent.id,
                error_code: paymentIntent.last_payment_error?.code,
                error_message: paymentIntent.last_payment_error?.message,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                timestamp: new Date().toISOString()
              },
              affected_user_id: sessionData.user_id
            });
          
          if (insertError) {
            console.error('Error inserting payment failure log:', insertError);
          } else {
            console.log('✅ Payment failure logged successfully');
          }
        } catch (logError) {
          console.error('Error logging payment failure:', logError);
        }
      }
    }

  } catch (error) {
    console.error('ERROR: Erro ao processar payment failed:', error);
  }
} 