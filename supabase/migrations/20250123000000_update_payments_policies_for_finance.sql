-- Migration: Update payments table policies to include finance role
-- This migration updates the RLS policies for the payments table to include the finance role

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can read all payments" ON payments;
DROP POLICY IF EXISTS "Only admins can manage payments" ON payments;

-- Recreate policies with finance role included
CREATE POLICY "Admins and finance can read all payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'finance')
    )
  );

-- Only admins and finance can insert/update/delete
CREATE POLICY "Admins and finance can manage payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'finance')
    )
  );

-- Add comments
COMMENT ON POLICY "Admins and finance can read all payments" ON payments IS 'Allows admin and finance roles to read all payments';
COMMENT ON POLICY "Admins and finance can manage payments" ON payments IS 'Allows admin and finance roles to manage all payments';
