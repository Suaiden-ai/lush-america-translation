-- Adicionar campos opcionais para rastreamento de falhas de upload
-- Estes campos ajudam a identificar e rastrear documentos que tiveram problemas no upload

-- Adicionar campo upload_failed_at para marcar quando o upload falhou
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS upload_failed_at TIMESTAMPTZ;

-- Adicionar campo upload_retry_count para contar tentativas de reenvio
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS upload_retry_count INTEGER DEFAULT 0;

-- Criar índice para busca eficiente de documentos com upload falhado
CREATE INDEX IF NOT EXISTS idx_documents_upload_failed 
ON documents(upload_failed_at) 
WHERE upload_failed_at IS NOT NULL;

-- Criar índice composto para busca de documentos problemáticos
CREATE INDEX IF NOT EXISTS idx_documents_missing_file 
ON documents(user_id, status, upload_failed_at) 
WHERE (file_url IS NULL OR file_url = '') 
AND upload_failed_at IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN documents.upload_failed_at IS 'Timestamp quando o upload do arquivo falhou após o pagamento';
COMMENT ON COLUMN documents.upload_retry_count IS 'Número de tentativas de reenvio do arquivo após falha inicial';

