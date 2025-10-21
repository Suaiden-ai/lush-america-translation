-- Fix get_all_affiliates_admin function to use proper balance calculation

CREATE OR REPLACE FUNCTION get_all_affiliates_admin()
RETURNS TABLE (
    affiliate_id uuid,
    user_id uuid,
    user_name text,
    user_email text,
    referral_code text,
    current_level integer,
    total_clients bigint,
    total_pages bigint,
    available_balance numeric,
    total_earned numeric,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as affiliate_id,
        a.user_id,
        p.name as user_name,
        p.email as user_email,
        a.referral_code,
        a.current_level,
        COUNT(DISTINCT ac.client_id) as total_clients,
        a.total_pages_referred as total_pages,
        -- Use the proper balance calculation function
        COALESCE(balance_info.available_balance, 0) as available_balance,
        a.total_commission_earned as total_earned,
        a.created_at
    FROM affiliates a
    JOIN profiles p ON a.user_id = p.id
    LEFT JOIN affiliate_commissions ac ON a.id = ac.affiliate_id AND ac.status = 'confirmed'
    LEFT JOIN LATERAL (
        SELECT * FROM get_affiliate_available_balance(a.id)
    ) balance_info ON true
    GROUP BY a.id, a.user_id, p.name, p.email, a.referral_code, a.current_level, a.total_pages_referred, a.total_commission_earned, a.created_at, balance_info.available_balance
    ORDER BY a.created_at DESC;
END;
$$;
