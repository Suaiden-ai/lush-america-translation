-- Adicionar coluna original_filename na tabela documents
ALTER TABLE documents 
ADD COLUMN original_filename TEXT;

-- Comentário para documentar a coluna
COMMENT ON COLUMN documents.original_filename IS 'Nome original do arquivo antes da geração do nome único';
