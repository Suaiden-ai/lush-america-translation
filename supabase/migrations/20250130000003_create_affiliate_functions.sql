-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    new_code text;
    code_exists boolean;
BEGIN
    LOOP
        -- Generate code in format AFF-XXXXX
        new_code := 'AFF-' || upper(substring(md5(random()::text) from 1 for 5));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM affiliates WHERE referral_code = new_code) INTO code_exists;
        
        -- If code doesn't exist, we can use it
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$;

-- Function to calculate affiliate commission
CREATE OR REPLACE FUNCTION calculate_affiliate_commission(
    p_payment_id uuid,
    p_document_id uuid,
    p_client_id uuid,
    p_pages_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affiliate_id uuid;
    v_referral_code text;
    v_current_level integer;
    v_commission_rate numeric(4,2);
    v_commission_amount numeric(10,2);
    v_affiliate_user_id uuid;
BEGIN
    -- Get referral code from client profile
    SELECT referred_by_code INTO v_referral_code
    FROM profiles 
    WHERE id = p_client_id;
    
    -- If no referral code, exit
    IF v_referral_code IS NULL THEN
        RETURN;
    END IF;
    
    -- Get affiliate info
    SELECT a.id, a.current_level, a.user_id
    INTO v_affiliate_id, v_current_level, v_affiliate_user_id
    FROM affiliates a
    WHERE a.referral_code = v_referral_code;
    
    -- If affiliate not found, exit
    IF v_affiliate_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Calculate commission rate based on level
    v_commission_rate := CASE 
        WHEN v_current_level = 1 THEN 0.50
        WHEN v_current_level = 2 THEN 1.00
        ELSE 0.50
    END;
    
    -- Calculate commission amount
    v_commission_amount := p_pages_count * v_commission_rate;
    
    -- Insert commission record
    INSERT INTO affiliate_commissions (
        affiliate_id,
        client_id,
        document_id,
        payment_id,
        pages_count,
        commission_rate,
        commission_amount,
        commission_level,
        status,
        available_for_withdrawal_at
    ) VALUES (
        v_affiliate_id,
        p_client_id,
        p_document_id,
        p_payment_id,
        p_pages_count,
        v_commission_rate,
        v_commission_amount,
        v_current_level,
        'confirmed',
        now() + interval '30 days'
    );
    
    -- Update affiliate totals (only total_commission_earned, not available_balance)
    UPDATE affiliates 
    SET 
        total_pages_referred = total_pages_referred + p_pages_count,
        total_commission_earned = total_commission_earned + v_commission_amount,
        updated_at = now()
    WHERE id = v_affiliate_id;
    
    -- Update available_balance using the new calculation function
    UPDATE affiliates
    SET available_balance = (
        SELECT available_balance 
        FROM get_affiliate_available_balance(v_affiliate_id)
    )
    WHERE id = v_affiliate_id;
    
    -- Check if affiliate should level up
    PERFORM update_affiliate_level(v_affiliate_id);
END;
$$;

-- Function to update affiliate level
CREATE OR REPLACE FUNCTION update_affiliate_level(p_affiliate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_pages integer;
    v_current_level integer;
BEGIN
    -- Get current level and total pages
    SELECT current_level, total_pages_referred
    INTO v_current_level, v_total_pages
    FROM affiliates
    WHERE id = p_affiliate_id;
    
    -- If already level 2 or less than 200 pages, no change needed
    IF v_current_level = 2 OR v_total_pages < 200 THEN
        RETURN;
    END IF;
    
    -- Update to level 2
    UPDATE affiliates 
    SET 
        current_level = 2,
        updated_at = now()
    WHERE id = p_affiliate_id;
END;
$$;

-- Function to reverse affiliate commission
CREATE OR REPLACE FUNCTION reverse_affiliate_commission(
    p_payment_id uuid,
    p_reversal_reason text DEFAULT 'Pagamento estornado/cancelado'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_commission_record affiliate_commissions%ROWTYPE;
BEGIN
    -- Get commission record
    SELECT * INTO v_commission_record
    FROM affiliate_commissions
    WHERE payment_id = p_payment_id 
    AND status = 'confirmed';
    
    -- If no commission found, exit
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Update commission status
    UPDATE affiliate_commissions
    SET 
        status = 'reversed',
        reversal_reason = p_reversal_reason,
        reversed_at = now()
    WHERE id = v_commission_record.id;
    
    -- Update affiliate balance (subtract the commission)
    UPDATE affiliates
    SET 
        available_balance = available_balance - v_commission_record.commission_amount,
        updated_at = now()
    WHERE id = v_commission_record.affiliate_id;
END;
$$;

-- RPC Functions for frontend

-- Get affiliate stats
CREATE OR REPLACE FUNCTION get_affiliate_stats(p_affiliate_user_id uuid)
RETURNS TABLE (
    total_balance numeric,
    total_earned numeric,
    total_clients bigint,
    total_pages bigint,
    current_level integer,
    referral_code text,
    pages_to_next_level integer,
    pending_balance numeric,
    next_withdrawal_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affiliate_id uuid;
    v_balance_info RECORD;
BEGIN
    -- Get affiliate ID
    SELECT id INTO v_affiliate_id
    FROM affiliates
    WHERE user_id = p_affiliate_user_id;
    
    IF v_affiliate_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Get balance information
    SELECT * INTO v_balance_info
    FROM get_affiliate_available_balance(v_affiliate_id);
    
    RETURN QUERY
    SELECT 
        v_balance_info.available_balance as total_balance,
        a.total_commission_earned as total_earned,
        COUNT(DISTINCT ac.client_id) as total_clients,
        a.total_pages_referred as total_pages,
        a.current_level,
        a.referral_code,
        CASE 
            WHEN a.current_level = 1 THEN GREATEST(0, 200 - a.total_pages_referred)
            ELSE 0
        END as pages_to_next_level,
        v_balance_info.pending_balance,
        v_balance_info.next_withdrawal_date
    FROM affiliates a
    LEFT JOIN affiliate_commissions ac ON a.id = ac.affiliate_id AND ac.status = 'confirmed'
    WHERE a.user_id = p_affiliate_user_id
    GROUP BY a.id, a.total_commission_earned, a.total_pages_referred, a.current_level, a.referral_code, v_balance_info.available_balance, v_balance_info.pending_balance, v_balance_info.next_withdrawal_date;
END;
$$;

-- Get affiliate clients
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
    JOIN affiliate_commissions ac ON p.id = ac.client_id
    JOIN affiliates a ON ac.affiliate_id = a.id
    WHERE a.user_id = p_affiliate_user_id
    AND ac.status = 'confirmed'
    GROUP BY p.id, p.name, p.email, p.created_at
    ORDER BY p.created_at DESC;
END;
$$;

-- Get affiliate commissions history
CREATE OR REPLACE FUNCTION get_affiliate_commissions_history(p_affiliate_user_id uuid)
RETURNS TABLE (
    id uuid,
    client_name text,
    pages_count integer,
    commission_rate numeric,
    commission_amount numeric,
    commission_level integer,
    status text,
    reversal_reason text,
    created_at timestamptz,
    reversed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ac.id,
        p.name as client_name,
        ac.pages_count,
        ac.commission_rate,
        ac.commission_amount,
        ac.commission_level,
        ac.status,
        ac.reversal_reason,
        ac.created_at,
        ac.reversed_at
    FROM affiliate_commissions ac
    JOIN affiliates a ON ac.affiliate_id = a.id
    JOIN profiles p ON ac.client_id = p.id
    WHERE a.user_id = p_affiliate_user_id
    ORDER BY ac.created_at DESC;
END;
$$;

-- Get all affiliates (admin only)
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
        a.available_balance,
        a.total_commission_earned as total_earned,
        a.created_at
    FROM affiliates a
    JOIN profiles p ON a.user_id = p.id
    LEFT JOIN affiliate_commissions ac ON a.id = ac.affiliate_id AND ac.status = 'confirmed'
    GROUP BY a.id, a.user_id, p.name, p.email, a.referral_code, a.current_level, a.total_pages_referred, a.available_balance, a.total_commission_earned, a.created_at
    ORDER BY a.created_at DESC;
END;
$$;

-- Get pending withdrawal requests (admin only)
CREATE OR REPLACE FUNCTION get_pending_withdrawal_requests()
RETURNS TABLE (
    request_id uuid,
    affiliate_id uuid,
    affiliate_name text,
    affiliate_email text,
    amount numeric,
    payment_method text,
    payment_details jsonb,
    status text,
    requested_at timestamptz,
    admin_notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        awr.id as request_id,
        awr.affiliate_id,
        p.name as affiliate_name,
        p.email as affiliate_email,
        awr.amount,
        awr.payment_method,
        awr.payment_details,
        awr.status,
        awr.requested_at,
        awr.admin_notes
    FROM affiliate_withdrawal_requests awr
    JOIN affiliates a ON awr.affiliate_id = a.id
    JOIN profiles p ON a.user_id = p.id
    ORDER BY awr.requested_at DESC;
END;
$$;

-- Function to create withdrawal request
CREATE OR REPLACE FUNCTION create_withdrawal_request(
    p_affiliate_user_id uuid,
    p_amount numeric,
    p_payment_method text,
    p_payment_details jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affiliate_id uuid;
    v_request_id uuid;
    v_available_balance numeric;
BEGIN
    -- Get affiliate ID
    SELECT id INTO v_affiliate_id
    FROM affiliates
    WHERE user_id = p_affiliate_user_id;
    
    IF v_affiliate_id IS NULL THEN
        RAISE EXCEPTION 'Afiliado não encontrado';
    END IF;
    
    -- Check available balance using the new calculation function
    SELECT available_balance INTO v_available_balance
    FROM get_affiliate_available_balance(v_affiliate_id);
    
    IF p_amount > v_available_balance THEN
        RAISE EXCEPTION 'Valor solicitado excede o saldo disponível';
    END IF;
    
    -- Create withdrawal request
    INSERT INTO affiliate_withdrawal_requests (
        affiliate_id,
        amount,
        payment_method,
        payment_details
    ) VALUES (
        v_affiliate_id,
        p_amount,
        p_payment_method,
        p_payment_details
    ) RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$;
