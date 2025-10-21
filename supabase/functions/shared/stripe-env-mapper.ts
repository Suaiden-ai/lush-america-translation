/**
 * Stripe Environment Variables Mapper
 * 
 * This module maps environment variables based on the detected environment
 * to ensure the correct Stripe keys are loaded automatically.
 */

import { EnvironmentInfo } from './environment-detector.ts';

export interface StripeEnvironmentVariables {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
}

/**
 * Gets Stripe environment variables based on the detected environment
 * 
 * @param envInfo - Environment information from detectEnvironment()
 * @returns StripeEnvironmentVariables object with the correct keys
 */
export function getStripeEnvironmentVariables(envInfo: EnvironmentInfo): StripeEnvironmentVariables {
  let suffix: string;
  if (envInfo.isProduction) {
    suffix = 'PROD';
  } else {
    suffix = 'TEST';
  }
  
  const config = {
    secretKey: Deno.env.get(`STRIPE_SECRET_KEY_${suffix}`) || '',
    webhookSecret: Deno.env.get(`STRIPE_WEBHOOK_SECRET_${suffix}`) || '',
    publishableKey: Deno.env.get(`STRIPE_PUBLISHABLE_KEY_${suffix}`) || ''
  };

  return config;
}

/**
 * Validates that all required Stripe environment variables are configured
 * 
 * @param config - Stripe environment variables to validate
 * @param envInfo - Environment information for error messages
 * @returns Array of validation error messages (empty if all valid)
 */
export function validateStripeEnvironmentVariables(
  config: StripeEnvironmentVariables, 
  envInfo: EnvironmentInfo
): string[] {
  const errors: string[] = [];
  let suffix: string;
  if (envInfo.isProduction) {
    suffix = 'PROD';
  } else {
    suffix = 'TEST';
  }

  if (!config.secretKey) {
    errors.push(`STRIPE_SECRET_KEY_${suffix} is required for ${envInfo.environment} environment`);
  }

  if (!config.webhookSecret) {
    errors.push(`STRIPE_WEBHOOK_SECRET_${suffix} is required for ${envInfo.environment} environment`);
  }

  if (!config.publishableKey) {
    errors.push(`STRIPE_PUBLISHABLE_KEY_${suffix} is required for ${envInfo.environment} environment`);
  }

  return errors;
}
