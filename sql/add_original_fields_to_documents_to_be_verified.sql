-- Adicionar colunas original_filename e original_document_id na tabela documents_to_be_verified
ALTER TABLE documents_to_be_verified 
ADD COLUMN original_filename TEXT,
ADD COLUMN original_document_id UUID;

-- Adicionar comentários para documentar as colunas
COMMENT ON COLUMN documents_to_be_verified.original_filename IS 'Nome original do arquivo antes da geração do nome único';
COMMENT ON COLUMN documents_to_be_verified.original_document_id IS 'ID do documento original na tabela documents';

-- Adicionar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_documents_to_be_verified_original_document_id 
ON documents_to_be_verified(original_document_id);

-- Adicionar foreign key constraint para original_document_id (opcional)
-- ALTER TABLE documents_to_be_verified 
-- ADD CONSTRAINT fk_documents_to_be_verified_original_document_id 
-- FOREIGN KEY (original_document_id) REFERENCES documents(id);
