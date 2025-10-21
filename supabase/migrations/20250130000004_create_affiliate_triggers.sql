-- Trigger to auto-generate referral code when affiliate is created
CREATE OR REPLACE FUNCTION trigger_generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Generate referral code if not provided
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_affiliates_generate_code
    BEFORE INSERT ON affiliates
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_referral_code();

-- Trigger to create affiliate record when user role changes to 'affiliate'
CREATE OR REPLACE FUNCTION trigger_create_affiliate_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- If role changed to 'affiliate' and no affiliate record exists
    IF NEW.role = 'affiliate' AND OLD.role != 'affiliate' THEN
        -- Check if affiliate record already exists
        IF NOT EXISTS (SELECT 1 FROM affiliates WHERE user_id = NEW.id) THEN
            INSERT INTO affiliates (user_id) VALUES (NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_profiles_create_affiliate
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_affiliate_on_role_change();

-- Trigger to calculate commission when payment is completed
CREATE OR REPLACE FUNCTION trigger_calculate_affiliate_commission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_document_id uuid;
    v_client_id uuid;
    v_pages_count integer;
BEGIN
    -- Only process when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get document info
        SELECT d.id, d.user_id, d.pages
        INTO v_document_id, v_client_id, v_pages_count
        FROM documents d
        WHERE d.id = NEW.document_id;
        
        -- If document found, calculate commission
        IF v_document_id IS NOT NULL THEN
            PERFORM calculate_affiliate_commission(
                NEW.id,
                v_document_id,
                v_client_id,
                v_pages_count
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_payments_calculate_commission
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_affiliate_commission();

-- Trigger to reverse commission when payment is refunded or cancelled
CREATE OR REPLACE FUNCTION trigger_reverse_affiliate_commission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_reversal_reason text;
BEGIN
    -- Check if payment was refunded or cancelled
    IF (NEW.status = 'refunded' AND (OLD.status IS NULL OR OLD.status != 'refunded')) OR
       (NEW.cancelled_at IS NOT NULL AND (OLD.cancelled_at IS NULL)) THEN
        
        -- Set reversal reason
        v_reversal_reason := CASE 
            WHEN NEW.status = 'refunded' THEN 'Pagamento estornado'
            WHEN NEW.cancelled_at IS NOT NULL THEN 'Pagamento cancelado'
            ELSE 'Pagamento estornado/cancelado'
        END;
        
        -- Reverse commission
        PERFORM reverse_affiliate_commission(NEW.id, v_reversal_reason);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_payments_reverse_commission
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reverse_affiliate_commission();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION trigger_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_affiliates_updated_at
    BEFORE UPDATE ON affiliates
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at();
