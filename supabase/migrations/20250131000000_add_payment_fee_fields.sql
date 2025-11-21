-- Migration: Add payment fee fields to payments table
-- This migration adds fields to store Stripe processing fees information

-- Add fee-related columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS base_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS gross_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS fee_amount numeric(10,2);

-- Add comments to document the new columns
COMMENT ON COLUMN payments.base_amount IS 'Base amount (net amount desired) before processing fees';
COMMENT ON COLUMN payments.gross_amount IS 'Gross amount (total amount charged to customer) including processing fees';
COMMENT ON COLUMN payments.fee_amount IS 'Processing fee amount paid by the customer';

-- Create index for fee_amount to enable fee analysis queries
CREATE INDEX IF NOT EXISTS idx_payments_fee_amount ON payments(fee_amount);

