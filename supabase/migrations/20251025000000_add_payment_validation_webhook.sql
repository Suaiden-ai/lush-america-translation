-- Migration: Add Payment Validation to stripe-webhook
-- This migration adds validation to ensure only paid documents are processed
-- Date: 2025-10-25
-- Issue: Documents with status "draft" were being processed without payment

-- This SQL file documents the fix applied to the stripe-webhook edge function
-- The fix ensures that only sessions with payment_status = 'paid' and status = 'complete' are processed

-- NO SQL migration needed - fix was applied directly to the edge function code
-- This file is for documentation purposes only

SELECT 
  'Payment validation added to stripe-webhook edge function' as migration_status,
  'Only documents with payment_status = paid and status = complete will be processed' as description,
  NOW() as applied_at;

