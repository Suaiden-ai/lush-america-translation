import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the request body
    const { paymentId, reason, adminUserId } = await req.json()

    if (!paymentId || !reason || !adminUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: paymentId, reason, adminUserId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`DEBUG: Starting cancellation process for payment ${paymentId}`)

    // Get payment details from database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      console.error('ERROR: Payment not found:', paymentError)
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if payment is already cancelled or refunded
    if (payment.status === 'cancelled' || payment.status === 'refunded') {
      return new Response(
        JSON.stringify({ error: 'Payment is already cancelled or refunded' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`DEBUG: Payment found - Status: ${payment.status}, Amount: ${payment.amount}`)

    // Get stripe session details if payment has stripe_session_id
    let stripeSession = null
    if (payment.stripe_session_id) {
      const { data: sessionData, error: sessionError } = await supabase
        .from('stripe_sessions')
        .select('*')
        .eq('session_id', payment.stripe_session_id)
        .single()
      
      if (!sessionError && sessionData) {
        stripeSession = sessionData
        console.log(`DEBUG: Found Stripe session: ${stripeSession.session_id}`)
      } else {
        console.log(`DEBUG: No Stripe session found for session_id: ${payment.stripe_session_id}`)
      }
    }

    let refundResult = null
    let cancellationStatus = 'cancelled'

    // If payment was completed via Stripe, create a refund
    if (stripeSession && stripeSession.session_id) {
      try {
        console.log(`DEBUG: Creating refund for Stripe session: ${stripeSession.session_id}`)
        
        // Get the payment intent from the session
        const session = await stripe.checkout.sessions.retrieve(stripeSession.session_id)
        
        if (session.payment_intent) {
          // Create refund
          refundResult = await stripe.refunds.create({
            payment_intent: session.payment_intent,
            reason: reason === 'fraud' ? 'fraudulent' : 'requested_by_customer',
            metadata: {
              admin_user_id: adminUserId,
              original_payment_id: paymentId,
              cancellation_reason: reason
            }
          })

          console.log(`SUCCESS: Refund created - ID: ${refundResult.id}`)
          cancellationStatus = 'refunded'
        } else {
          console.log('WARNING: No payment intent found in session, marking as cancelled')
        }
      } catch (stripeError: any) {
        console.error('ERROR: Stripe refund failed:', stripeError)
        // Continue with cancellation even if refund fails
        cancellationStatus = 'cancelled'
      }
    }

    // Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: cancellationStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)

    if (updateError) {
      console.error('ERROR: Failed to update payment status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update payment status' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update stripe_sessions status if exists
    if (stripeSession) {
      await supabase
        .from('stripe_sessions')
        .update({
          payment_status: cancellationStatus,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', stripeSession.session_id)
    }

    // Get user details for notification
    const { data: user } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', payment.user_id)
      .single()

    // Send notification to user about cancellation
    if (user) {
      try {
        const notificationPayload = {
          user_name: user.name || 'Unknown User',
          user_email: user.email,
          notification_type: 'Payment Cancelled',
          timestamp: new Date().toISOString(),
          filename: payment.document_id ? 'Document' : 'Unknown',
          document_id: payment.document_id,
          status: `Payment ${cancellationStatus === 'refunded' ? 'refunded' : 'cancelled'}`,
          cancellation_reason: reason,
          refund_id: refundResult?.id || null
        }

        const webhookResponse = await fetch('https://nwh.thefutureofenglish.com/webhook/notthelush1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationPayload)
        })

        if (webhookResponse.ok) {
          console.log(`SUCCESS: Cancellation notification sent to user: ${user.email}`)
        } else {
          console.error(`WARNING: Failed to send cancellation notification: ${webhookResponse.status}`)
        }
      } catch (notificationError) {
        console.error('ERROR: Failed to send cancellation notification:', notificationError)
      }
    }

    console.log(`SUCCESS: Payment ${paymentId} ${cancellationStatus} successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: cancellationStatus,
        refund_id: refundResult?.id || null,
        message: `Payment ${cancellationStatus === 'refunded' ? 'refunded' : 'cancelled'} successfully`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('ERROR: Cancel payment function failed:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
