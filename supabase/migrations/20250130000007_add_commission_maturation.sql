-- Add commission maturation system
-- This migration implements the new withdrawal system where each commission has a 30-day maturation period

-- Add available_for_withdrawal_at column to affiliate_commissions
ALTER TABLE affiliate_commissions 
ADD COLUMN available_for_withdrawal_at timestamptz;

-- Add withdrawn_amount column to track partial withdrawals
ALTER TABLE affiliate_commissions 
ADD COLUMN withdrawn_amount numeric(10,2) DEFAULT 0;

-- Add status for withdrawn commissions
ALTER TABLE affiliate_commissions 
ADD CONSTRAINT check_status_withdrawn CHECK (status IN ('pending', 'confirmed', 'reversed', 'withdrawn'));

-- Update existing commissions to have available_for_withdrawal_at = created_at + 30 days
UPDATE affiliate_commissions 
SET available_for_withdrawal_at = created_at + interval '30 days'
WHERE available_for_withdrawal_at IS NULL;

-- Remove last_withdrawal_request_date from affiliates table
ALTER TABLE affiliates 
DROP COLUMN IF EXISTS last_withdrawal_request_date;

-- Add comments
COMMENT ON COLUMN affiliate_commissions.available_for_withdrawal_at IS 'Data quando a comissão ficará disponível para saque (created_at + 30 dias)';
COMMENT ON COLUMN affiliate_commissions.withdrawn_amount IS 'Valor já sacado desta comissão (para tracking de saques parciais)';
