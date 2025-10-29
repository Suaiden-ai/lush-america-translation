import { supabase } from './supabase';
import { ActionTypes } from '../types/actionTypes';

/**
 * Helper class for logging common actions
 * All methods are non-blocking - they won't fail the main operation if logging fails
 */
export class Logger {
  /**
   * Log an authentication action
   */
  static async logAuth(
    actionType: string,
    description: string,
    metadata?: Record<string, any>
  ) {
    try {
      await Logger._log(actionType, description, {
        entityType: 'user',
        metadata: { ...metadata, category: 'auth' },
      });
    } catch (err) {
      console.warn('[Logger] Failed to log auth action:', err);
    }
  }

  /**
   * Log a document action
   */
  static async logDocument(
    actionType: string,
    docId: string,
    description: string,
    metadata?: Record<string, any>
  ) {
    try {
      await Logger._log(actionType, description, {
        entityType: 'document',
        entityId: docId,
        metadata: { ...metadata, category: 'document' },
      });
    } catch (err) {
      console.warn('[Logger] Failed to log document action:', err);
    }
  }

  /**
   * Log a payment action
   */
  static async logPayment(
    actionType: string,
    paymentId: string,
    description: string,
    metadata?: Record<string, any>
  ) {
    try {
      await Logger._log(actionType, description, {
        entityType: 'payment',
        entityId: paymentId,
        metadata: { ...metadata, category: 'payment' },
      });
    } catch (err) {
      console.warn('[Logger] Failed to log payment action:', err);
    }
  }

  /**
   * Log an admin action affecting a user
   */
  static async logAdminAction(
    actionType: string,
    targetUserId: string,
    description: string,
    metadata?: Record<string, any>
  ) {
    try {
      await Logger._log(actionType, description, {
        entityType: 'user',
        entityId: targetUserId,
        affectedUserId: targetUserId,
        performerType: 'admin',
        metadata: { ...metadata, category: 'admin' },
      });
    } catch (err) {
      console.warn('[Logger] Failed to log admin action:', err);
    }
  }

  /**
   * Log a system action (for webhooks, etc.)
   */
  static async logSystem(
    actionType: string,
    description: string,
    metadata?: Record<string, any>
  ) {
    try {
      // Use log_system_action for system actions (no auth required)
      const enrichedMetadata = await Logger._enrichMetadata(metadata);
      
      console.log('[Logger] Calling log_system_action RPC with params:', {
        p_action_type: actionType,
        p_action_description: description,
        p_entity_type: null,
        p_entity_id: null,
        p_metadata: Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : null,
        p_affected_user_id: null,
      });

      const { error } = await supabase.rpc('log_system_action', {
        p_action_type: actionType,
        p_action_description: description,
        p_entity_type: null,
        p_entity_id: null,
        p_metadata: Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : null,
        p_affected_user_id: null,
      });

      if (error) {
        console.error('[Logger] Error calling log_system_action:', error);
      } else {
        console.log('[Logger] log_system_action RPC call successful');
      }
    } catch (err) {
      console.warn('[Logger] Failed to log system action:', err);
    }
  }

  /**
   * Generic log method for any action
   */
  static async log(
    actionType: string,
    description: string,
    options?: {
      entityType?: string;
      entityId?: string;
      affectedUserId?: string;
      performerType?: 'user' | 'admin' | 'authenticator' | 'finance' | 'affiliate' | 'system';
      metadata?: Record<string, any>;
    }
  ) {
    try {
      console.log('[Logger] Attempting to log action:', actionType, description);
      await Logger._log(actionType, description, options);
      console.log('[Logger] Successfully logged action:', actionType);
    } catch (err) {
      console.warn('[Logger] Failed to log action:', err);
      // Don't throw - logging should never break the app
    }
  }

  /**
   * Low-level logging function
   */
  private static async _log(
    actionType: string,
    description: string,
    options?: {
      entityType?: string;
      entityId?: string;
      affectedUserId?: string;
      performerType?: 'user' | 'admin' | 'authenticator' | 'finance' | 'affiliate' | 'system';
      metadata?: Record<string, any>;
    }
  ) {
    try {
      // Try to get IP address (non-blocking)
      const enrichedMetadata = await Logger._enrichMetadata(options?.metadata);

      console.log('[Logger] Calling log_action RPC with params:', {
        p_action_type: actionType,
        p_action_description: description,
        p_entity_type: options?.entityType || null,
        p_entity_id: options?.entityId || null,
        p_metadata: Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : null,
        p_affected_user_id: options?.affectedUserId || null,
        p_performed_by_type: options?.performerType || 'user',
      });

      const { error } = await supabase.rpc('log_action', {
        p_action_type: actionType,
        p_action_description: description,
        p_entity_type: options?.entityType || null,
        p_entity_id: options?.entityId || null,
        p_metadata: Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : null,
        p_affected_user_id: options?.affectedUserId || null,
        p_performed_by_type: options?.performerType || 'user',
      });

      if (error) {
        console.error('[Logger] Error calling log_action:', error);
      } else {
        console.log('[Logger] log_action RPC call successful');
      }
    } catch (err) {
      console.error('[Logger] Unexpected error:', err);
      // Don't throw - logging should never break the app
    }
  }

  /**
   * Enrich metadata with IP address if available (non-blocking)
   */
  private static async _enrichMetadata(
    metadata?: Record<string, any>
  ): Promise<Record<string, any>> {
    const base = metadata || {};

    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        return { ...base, ip: data?.ip };
      }
    } catch (err) {
      // Silent fail - IP enrichment is optional
      console.debug('[Logger] Could not enrich metadata with IP');
    }

    return base;
  }
}

