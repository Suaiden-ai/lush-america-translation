/**
 * Centralized Stripe Configuration
 * 
 * This module provides a centralized way to get Stripe configuration
 * that automatically detects the environment and loads the correct keys.
 */

import { detectEnvironment, EnvironmentInfo } from './environment-detector.ts';
import { getStripeEnvironmentVariables, validateStripeEnvironmentVariables, StripeEnvironmentVariables } from './stripe-env-mapper.ts';

export interface StripeConfig {
  // Core Stripe configuration
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  
  // Environment information
  environment: EnvironmentInfo;
  
  // Additional configuration
  apiVersion: string;
  appInfo: {
    name: string;
    version: string;
  };
}

/**
 * Gets the complete Stripe configuration based on the current environment
 * 
 * @param req - The HTTP request object
 * @returns StripeConfig object with all necessary configuration
 * @throws Error if configuration is invalid or missing
 */
export function getStripeConfig(req: Request): StripeConfig {
  // Detect environment automatically
  const envInfo = detectEnvironment(req);
  
  // Get environment variables based on detected environment
  const envVars = getStripeEnvironmentVariables(envInfo);
  
  // Validate that all required variables are configured
  const validationErrors = validateStripeEnvironmentVariables(envVars, envInfo);
  if (validationErrors.length > 0) {
    throw new Error(`Stripe configuration errors: ${validationErrors.join(', ')}`);
  }

  const config: StripeConfig = {
    // Core Stripe keys
    secretKey: envVars.secretKey,
    webhookSecret: envVars.webhookSecret,
    publishableKey: envVars.publishableKey,
    
    // Environment information
    environment: envInfo,
    
    // Stripe API configuration
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'Lush America Translations',
      version: '1.0.0'
    }
  };

  // Log configuration (with masked sensitive data)
  console.log(`🔑 Stripe Config (${envInfo.environment}):`, {
    secretKey: config.secretKey ? `${config.secretKey.substring(0, 20)}...` : '❌ Missing',
    webhookSecret: config.webhookSecret ? `${config.webhookSecret.substring(0, 20)}...` : '❌ Missing',
    publishableKey: config.publishableKey ? `${config.publishableKey.substring(0, 20)}...` : '❌ Missing',
    apiVersion: config.apiVersion,
    appInfo: config.appInfo
  });

  console.log(`✅ Stripe config loaded for ${envInfo.environment} environment`);

  return config;
}
