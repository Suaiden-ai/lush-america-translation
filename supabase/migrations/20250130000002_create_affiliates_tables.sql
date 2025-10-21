-- Create affiliates table
CREATE TABLE affiliates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    referral_code text NOT NULL UNIQUE,
    current_level integer NOT NULL DEFAULT 1 CHECK (current_level IN (1, 2)),
    total_pages_referred integer NOT NULL DEFAULT 0,
    total_commission_earned numeric(10,2) NOT NULL DEFAULT 0,
    available_balance numeric(10,2) NOT NULL DEFAULT 0,
    last_withdrawal_request_date timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add comments
COMMENT ON TABLE affiliates IS 'Tabela de afiliados com informações de comissões e níveis';
COMMENT ON COLUMN affiliates.referral_code IS 'Código único de indicação do afiliado';
COMMENT ON COLUMN affiliates.current_level IS 'Nível atual do afiliado: 1 ($0.50/página) ou 2 ($1.00/página)';
COMMENT ON COLUMN affiliates.total_pages_referred IS 'Total de páginas traduzidas por clientes indicados';
COMMENT ON COLUMN affiliates.total_commission_earned IS 'Total de comissões ganhas (histórico)';
COMMENT ON COLUMN affiliates.available_balance IS 'Saldo disponível para saque';
COMMENT ON COLUMN affiliates.last_withdrawal_request_date IS 'Data da última solicitação de saque';

-- Create affiliate_commissions table
CREATE TABLE affiliate_commissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
    payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    pages_count integer NOT NULL,
    commission_rate numeric(4,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    commission_level integer NOT NULL CHECK (commission_level IN (1, 2)),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'reversed')),
    reversal_reason text,
    created_at timestamptz DEFAULT now(),
    reversed_at timestamptz
);

-- Add comments
COMMENT ON TABLE affiliate_commissions IS 'Histórico de comissões dos afiliados';
COMMENT ON COLUMN affiliate_commissions.commission_rate IS 'Taxa de comissão por página ($0.50 ou $1.00)';
COMMENT ON COLUMN affiliate_commissions.commission_amount IS 'Valor total da comissão (pages_count * commission_rate)';
COMMENT ON COLUMN affiliate_commissions.commission_level IS 'Nível do afiliado quando a comissão foi gerada';
COMMENT ON COLUMN affiliate_commissions.status IS 'Status da comissão: pending, confirmed, reversed';
COMMENT ON COLUMN affiliate_commissions.reversal_reason IS 'Motivo do estorno da comissão';

-- Create affiliate_withdrawal_requests table
CREATE TABLE affiliate_withdrawal_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    payment_method text NOT NULL CHECK (payment_method IN ('zelle', 'bank_transfer', 'stripe', 'other')),
    payment_details jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    requested_at timestamptz DEFAULT now(),
    processed_at timestamptz,
    processed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    admin_notes text
);

-- Add comments
COMMENT ON TABLE affiliate_withdrawal_requests IS 'Solicitações de saque dos afiliados';
COMMENT ON COLUMN affiliate_withdrawal_requests.payment_method IS 'Método de pagamento escolhido pelo afiliado';
COMMENT ON COLUMN affiliate_withdrawal_requests.payment_details IS 'Detalhes do método de pagamento (email, dados bancários, etc)';
COMMENT ON COLUMN affiliate_withdrawal_requests.status IS 'Status da solicitação: pending, approved, rejected, completed';
COMMENT ON COLUMN affiliate_withdrawal_requests.processed_by IS 'Admin que processou a solicitação';

-- Create indexes for better performance
CREATE INDEX idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_client_id ON affiliate_commissions(client_id);
CREATE INDEX idx_affiliate_commissions_payment_id ON affiliate_commissions(payment_id);
CREATE INDEX idx_affiliate_commissions_status ON affiliate_commissions(status);
CREATE INDEX idx_affiliate_withdrawal_requests_affiliate_id ON affiliate_withdrawal_requests(affiliate_id);
CREATE INDEX idx_affiliate_withdrawal_requests_status ON affiliate_withdrawal_requests(status);
CREATE INDEX idx_profiles_referred_by_code ON profiles(referred_by_code);
