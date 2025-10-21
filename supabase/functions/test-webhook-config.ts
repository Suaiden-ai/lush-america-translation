/**
 * Test script to verify webhook configuration
 * This script helps debug webhook signature issues by testing environment detection
 */

import { detectEnvironment } from './shared/environment-detector.ts';
import { getStripeConfig } from './shared/stripe-config.ts';

// Simulate a Stripe webhook request
const mockStripeWebhookRequest = new Request('https://example.com/stripe-webhook', {
  method: 'POST',
  headers: {
    'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
    'stripe-signature': 'test-signature',
    'content-type': 'application/json'
  },
  body: JSON.stringify({ test: 'data' })
});

console.log('🧪 Testing webhook configuration...\n');

try {
  // Test environment detection
  console.log('1. Testing environment detection:');
  const envInfo = detectEnvironment(mockStripeWebhookRequest);
  console.log('   Environment detected:', envInfo.environment);
  console.log('   Is production:', envInfo.isProduction);
  console.log('   Is test:', envInfo.isTest);
  console.log('   User agent:', envInfo.userAgent);
  console.log('');

  // Test Stripe configuration
  console.log('2. Testing Stripe configuration:');
  const stripeConfig = getStripeConfig(mockStripeWebhookRequest);
  console.log('   Environment:', stripeConfig.environment.environment);
  console.log('   Secret key available:', !!stripeConfig.secretKey);
  console.log('   Webhook secret available:', !!stripeConfig.webhookSecret);
  console.log('   Publishable key available:', !!stripeConfig.publishableKey);
  console.log('');

  // Check environment variables
  console.log('3. Environment variables check:');
  console.log('   STRIPE_SECRET_KEY_PROD:', !!Deno.env.get('STRIPE_SECRET_KEY_PROD'));
  console.log('   STRIPE_WEBHOOK_SECRET_PROD:', !!Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD'));
  console.log('   STRIPE_PUBLISHABLE_KEY_PROD:', !!Deno.env.get('STRIPE_PUBLISHABLE_KEY_PROD'));
  console.log('   STRIPE_SECRET_KEY_TEST:', !!Deno.env.get('STRIPE_SECRET_KEY_TEST'));
  console.log('   STRIPE_WEBHOOK_SECRET_TEST:', !!Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST'));
  console.log('   STRIPE_PUBLISHABLE_KEY_TEST:', !!Deno.env.get('STRIPE_PUBLISHABLE_KEY_TEST'));
  console.log('');

  console.log('✅ Configuration test completed successfully');

} catch (error) {
  console.error('❌ Configuration test failed:', error.message);
  console.error('Error details:', error);
}
