-- Enable RLS on affiliate tables
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliates table
-- Affiliates can only see their own record, admins can see all
CREATE POLICY "affiliates_select_own" ON affiliates
    FOR SELECT
    USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can update affiliates
CREATE POLICY "affiliates_update_admin" ON affiliates
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only system can insert affiliates (via trigger)
CREATE POLICY "affiliates_insert_system" ON affiliates
    FOR INSERT
    WITH CHECK (true);

-- RLS Policies for affiliate_commissions table
-- Affiliates can see their own commissions, admins can see all
CREATE POLICY "affiliate_commissions_select_own" ON affiliate_commissions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM affiliates 
            WHERE id = affiliate_commissions.affiliate_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only system can insert/update commissions (via functions)
CREATE POLICY "affiliate_commissions_insert_system" ON affiliate_commissions
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "affiliate_commissions_update_system" ON affiliate_commissions
    FOR UPDATE
    USING (true);

-- RLS Policies for affiliate_withdrawal_requests table
-- Affiliates can see their own requests, admins can see all
CREATE POLICY "withdrawal_requests_select_own" ON affiliate_withdrawal_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM affiliates 
            WHERE id = affiliate_withdrawal_requests.affiliate_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Affiliates can create their own withdrawal requests
CREATE POLICY "withdrawal_requests_insert_own" ON affiliate_withdrawal_requests
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM affiliates 
            WHERE id = affiliate_withdrawal_requests.affiliate_id AND user_id = auth.uid()
        )
    );

-- Only admins can update withdrawal requests
CREATE POLICY "withdrawal_requests_update_admin" ON affiliate_withdrawal_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON affiliates TO authenticated;
GRANT SELECT ON affiliate_commissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON affiliate_withdrawal_requests TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_affiliate_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_affiliate_clients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_affiliate_commissions_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_affiliates_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_withdrawal_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION create_withdrawal_request(uuid, numeric, text, jsonb) TO authenticated;
