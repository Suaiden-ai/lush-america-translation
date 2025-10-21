-- Fix affiliate client counting to show ALL referred users, not just those with commissions

-- Update get_affiliate_stats to count ALL referred users
CREATE OR REPLACE FUNCTION get_affiliate_stats(p_affiliate_user_id uuid)
RETURNS TABLE (
    total_balance numeric,
    total_earned numeric,
    total_clients bigint,
    total_pages bigint,
    current_level integer,
    referral_code text,
    pages_to_next_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.available_balance as total_balance,
        a.total_commission_earned as total_earned,
        -- Count ALL users who registered with this affiliate's referral code
        (SELECT COUNT(*) FROM profiles p WHERE p.referred_by_code = a.referral_code) as total_clients,
        a.total_pages_referred as total_pages,
        a.current_level,
        a.referral_code,
        CASE 
            WHEN a.current_level = 1 THEN GREATEST(0, 200 - a.total_pages_referred)
            ELSE 0
        END as pages_to_next_level
    FROM affiliates a
    WHERE a.user_id = p_affiliate_user_id;
END;
$$;

-- Create new function to get ALL referred clients (with or without commissions)
CREATE OR REPLACE FUNCTION get_all_affiliate_clients(p_affiliate_user_id uuid)
RETURNS TABLE (
    client_id uuid,
    client_name text,
    client_email text,
    registered_at timestamptz,
    total_pages bigint,
    total_commission numeric,
    has_commissions boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as client_id,
        p.name as client_name,
        p.email as client_email,
        p.created_at as registered_at,
        COALESCE(SUM(ac.pages_count), 0) as total_pages,
        COALESCE(SUM(ac.commission_amount), 0) as total_commission,
        CASE WHEN SUM(ac.pages_count) > 0 THEN true ELSE false END as has_commissions
    FROM profiles p
    JOIN affiliates a ON p.referred_by_code = a.referral_code
    LEFT JOIN affiliate_commissions ac ON p.id = ac.client_id AND ac.status = 'confirmed'
    WHERE a.user_id = p_affiliate_user_id
    GROUP BY p.id, p.name, p.email, p.created_at
    ORDER BY p.created_at DESC;
END;
$$;

-- Update the original get_affiliate_clients to use the new logic
CREATE OR REPLACE FUNCTION get_affiliate_clients(p_affiliate_user_id uuid)
RETURNS TABLE (
    client_id uuid,
    client_name text,
    client_email text,
    registered_at timestamptz,
    total_pages bigint,
    total_commission numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as client_id,
        p.name as client_name,
        p.email as client_email,
        p.created_at as registered_at,
        COALESCE(SUM(ac.pages_count), 0) as total_pages,
        COALESCE(SUM(ac.commission_amount), 0) as total_commission
    FROM profiles p
    JOIN affiliates a ON p.referred_by_code = a.referral_code
    LEFT JOIN affiliate_commissions ac ON p.id = ac.client_id AND ac.status = 'confirmed'
    WHERE a.user_id = p_affiliate_user_id
    GROUP BY p.id, p.name, p.email, p.created_at
    ORDER BY p.created_at DESC;
END;
$$;
