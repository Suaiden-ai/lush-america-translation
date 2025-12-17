-- Adicionar coluna idioma_destino na tabela documents
ALTER TABLE documents 
ADD COLUMN idioma_destino TEXT DEFAULT 'English';

-- Comentário sobre a coluna
COMMENT ON COLUMN documents.idioma_destino IS 'Idioma de destino para tradução do documento';
