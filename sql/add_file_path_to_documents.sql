-- Adicionar campo file_path à tabela documents para armazenar o caminho do arquivo no Storage
-- Esta migração permite armazenar o caminho do arquivo no Supabase Storage
-- especialmente importante para pagamentos Zelle onde o arquivo é enviado durante o pagamento

-- Adicionar coluna file_path à tabela documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN documents.file_path IS 'Storage path of the document file in Supabase Storage';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);
