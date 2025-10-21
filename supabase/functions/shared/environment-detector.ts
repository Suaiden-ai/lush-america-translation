/**
 * Environment Detection for Stripe Configuration
 * 
 * This module detects the current environment (production vs test) based on HTTP headers
 * to ensure the correct Stripe keys are used automatically.
 */

export interface EnvironmentInfo {
  environment: 'production' | 'test';
  isProduction: boolean;
  isTest: boolean;
  referer: string;
  origin: string;
  host: string;
  userAgent?: string;
}

/**
 * Detects the current environment based on HTTP request headers
 * 
 * @param req - The HTTP request object
 * @returns EnvironmentInfo object with environment details
 */
export function detectEnvironment(req: Request): EnvironmentInfo {
  const referer = req.headers.get('referer') || '';
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const userAgent = req.headers.get('user-agent') || '';
  
  // Detect production: if any header contains lushamerica.com OR if it's a Stripe webhook
  // Stripe webhooks don't have referer/origin, so we need to check for Stripe user agent
  const isStripeWebhook = userAgent.includes('Stripe/');
  const isProductionDomain = 
    referer.includes('lushamerica.com') ||
    origin.includes('lushamerica.com') ||
    host.includes('lushamerica.com');
  
  // For Stripe webhooks, we need to determine environment differently
  // Check if we have production environment variables available
  const hasProdKeys = Deno.env.get('STRIPE_SECRET_KEY_PROD') && 
                     Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD');
  
  const isProduction = isProductionDomain || (isStripeWebhook && hasProdKeys);
    
  // Determine environment: production > test
  let environment: 'production' | 'test';
  if (isProduction) {
    environment = 'production';
  } else {
    environment = 'test';
  }

  const envInfo: EnvironmentInfo = {
    environment,
    isProduction,
    isTest: !isProduction,
    referer,
    origin,
    host,
    userAgent
  };

  // Log environment detection for debugging
  console.log('🔍 Environment Detection:', {
    referer,
    origin,
    host,
    environment,
    userAgent: userAgent.substring(0, 100) + '...', // Truncate for readability
    isStripeWebhook,
    isProductionDomain,
    hasProdKeys
  });

  console.log(`🎯 Environment detected: ${environment.toUpperCase()}`);

  return envInfo;
}
