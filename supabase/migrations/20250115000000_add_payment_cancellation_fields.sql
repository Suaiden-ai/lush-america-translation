-- Migration: Add payment cancellation fields
-- This migration adds fields to support payment cancellation and refunds

-- Add cancellation fields to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS refund_id text,
ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2);

-- Add cancellation fields to stripe_sessions table
ALTER TABLE stripe_sessions 
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS refund_id text;

-- Create indexes for better performance on cancellation queries
CREATE INDEX IF NOT EXISTS idx_payments_cancelled_at ON payments(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_payments_cancelled_by ON payments(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_payments_refund_id ON payments(refund_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_cancelled_at ON stripe_sessions(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_cancelled_by ON stripe_sessions(cancelled_by);

-- Add comments to document the new fields
COMMENT ON COLUMN payments.cancelled_at IS 'Timestamp when payment was cancelled';
COMMENT ON COLUMN payments.cancelled_by IS 'Admin user who cancelled the payment';
COMMENT ON COLUMN payments.cancellation_reason IS 'Reason for payment cancellation';
COMMENT ON COLUMN payments.refund_id IS 'Stripe refund ID if payment was refunded';
COMMENT ON COLUMN payments.refund_amount IS 'Amount refunded (may be partial)';

COMMENT ON COLUMN stripe_sessions.cancelled_at IS 'Timestamp when session was cancelled';
COMMENT ON COLUMN stripe_sessions.cancelled_by IS 'Admin user who cancelled the session';
COMMENT ON COLUMN stripe_sessions.cancellation_reason IS 'Reason for session cancellation';
COMMENT ON COLUMN stripe_sessions.refund_id IS 'Stripe refund ID if session was refunded';
