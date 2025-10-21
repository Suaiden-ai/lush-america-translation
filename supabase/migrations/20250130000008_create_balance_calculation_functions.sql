-- Create functions for calculating available and pending balances

-- Function to calculate affiliate available balance
CREATE OR REPLACE FUNCTION get_affiliate_available_balance(p_affiliate_id uuid)
RETURNS TABLE (
    available_balance numeric,
    pending_balance numeric,
    next_withdrawal_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN ac.status = 'confirmed' 
                AND ac.available_for_withdrawal_at <= now() 
                THEN ac.commission_amount - COALESCE(ac.withdrawn_amount, 0)
                ELSE 0
            END
        ), 0) as available_balance,
        COALESCE(SUM(
            CASE 
                WHEN ac.status = 'confirmed' 
                AND ac.available_for_withdrawal_at > now() 
                THEN ac.commission_amount - COALESCE(ac.withdrawn_amount, 0)
                ELSE 0
            END
        ), 0) as pending_balance,
        MIN(
            CASE 
                WHEN ac.status = 'confirmed' 
                AND ac.available_for_withdrawal_at > now() 
                THEN ac.available_for_withdrawal_at
                ELSE NULL
            END
        ) as next_withdrawal_date
    FROM affiliate_commissions ac
    WHERE ac.affiliate_id = p_affiliate_id;
END;
$$;

-- Function to process withdrawal approval (mark commissions as withdrawn)
CREATE OR REPLACE FUNCTION process_withdrawal_approval(
    p_withdrawal_request_id uuid,
    p_approved_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affiliate_id uuid;
    v_remaining_amount numeric := p_approved_amount;
    v_commission_record RECORD;
BEGIN
    -- Get affiliate ID from withdrawal request
    SELECT affiliate_id INTO v_affiliate_id
    FROM affiliate_withdrawal_requests
    WHERE id = p_withdrawal_request_id;
    
    IF v_affiliate_id IS NULL THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;
    
    -- Process commissions in FIFO order (oldest first)
    FOR v_commission_record IN
        SELECT id, commission_amount, withdrawn_amount
        FROM affiliate_commissions
        WHERE affiliate_id = v_affiliate_id
        AND status = 'confirmed'
        AND available_for_withdrawal_at <= now()
        AND (commission_amount - COALESCE(withdrawn_amount, 0)) > 0
        ORDER BY created_at ASC
    LOOP
        DECLARE
            v_available_amount numeric;
            v_withdraw_amount numeric;
        BEGIN
            v_available_amount := v_commission_record.commission_amount - COALESCE(v_commission_record.withdrawn_amount, 0);
            
            IF v_remaining_amount <= 0 THEN
                EXIT;
            END IF;
            
            -- Calculate how much to withdraw from this commission
            v_withdraw_amount := LEAST(v_remaining_amount, v_available_amount);
            
            -- Update commission withdrawn amount
            UPDATE affiliate_commissions
            SET withdrawn_amount = COALESCE(withdrawn_amount, 0) + v_withdraw_amount,
                status = CASE 
                    WHEN (commission_amount - COALESCE(withdrawn_amount, 0) - v_withdraw_amount) <= 0 
                    THEN 'withdrawn'
                    ELSE 'confirmed'
                END
            WHERE id = v_commission_record.id;
            
            v_remaining_amount := v_remaining_amount - v_withdraw_amount;
        END;
    END LOOP;
    
    -- Update affiliate available_balance
    UPDATE affiliates
    SET available_balance = (
        SELECT available_balance 
        FROM get_affiliate_available_balance(v_affiliate_id)
    )
    WHERE id = v_affiliate_id;
END;
$$;

-- Add comments
COMMENT ON FUNCTION get_affiliate_available_balance IS 'Calcula saldo disponível, pendente e próxima data de liberação do afiliado';
COMMENT ON FUNCTION process_withdrawal_approval IS 'Processa aprovação de saque marcando comissões como sacadas em ordem FIFO';
