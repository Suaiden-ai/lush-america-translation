-- ==============================================
-- TABELA HISTÓRICO PAGAMENTOS ZELLE - POSTGRESQL
-- Script para criação da tabela zelle_payment_history
-- ==============================================

-- Criar a tabela se não existir
CREATE TABLE IF NOT EXISTS zelle_payment_history (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    zelle_confirmation_code VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    document_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_zelle_payment_history_payment_id 
ON zelle_payment_history(payment_id);

CREATE INDEX IF NOT EXISTS idx_zelle_payment_history_user_id 
ON zelle_payment_history(user_id);

CREATE INDEX IF NOT EXISTS idx_zelle_payment_history_created_at 
ON zelle_payment_history(created_at);

-- Adicionar comentários para documentação
COMMENT ON TABLE zelle_payment_history IS 'Histórico de códigos de confirmação Zelle para auditoria';
COMMENT ON COLUMN zelle_payment_history.payment_id IS 'ID do pagamento no Supabase';
COMMENT ON COLUMN zelle_payment_history.user_id IS 'ID do usuário no Supabase';
COMMENT ON COLUMN zelle_payment_history.zelle_confirmation_code IS 'Código de confirmação Zelle fornecido pelo usuário';
COMMENT ON COLUMN zelle_payment_history.amount IS 'Valor do pagamento em USD';
COMMENT ON COLUMN zelle_payment_history.user_name IS 'Nome do usuário';
COMMENT ON COLUMN zelle_payment_history.user_email IS 'Email do usuário';
COMMENT ON COLUMN zelle_payment_history.document_filename IS 'Nome do arquivo do documento traduzido';

-- Verificar se a tabela foi criada
SELECT 
    tablename, 
    schemaname, 
    tableowner 
FROM pg_tables 
WHERE tablename = 'zelle_payment_history';

-- Verificar estrutura da tabela
\d zelle_payment_history;
