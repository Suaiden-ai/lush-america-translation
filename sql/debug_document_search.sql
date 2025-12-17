-- Analisar documento específico e estrutura das tabelas
-- ID do documento: 2780368c-8ef6-4424-9b90-34339adc414f

-- Verificar se existe na tabela documents
SELECT 'documents' as tabela, * FROM documents 
WHERE id = '2780368c-8ef6-4424-9b90-34339adc414f';

-- Verificar se existe na tabela documents_to_be_verified
SELECT 'documents_to_be_verified' as tabela, * FROM documents_to_be_verified 
WHERE id = '2780368c-8ef6-4424-9b90-34339adc414f';

-- Verificar se existe na tabela translated_documents
SELECT 'translated_documents' as tabela, * FROM translated_documents 
WHERE document_id = '2780368c-8ef6-4424-9b90-34339adc414f' 
   OR original_document_id = '2780368c-8ef6-4424-9b90-34339adc414f';

-- Verificar payment associado
SELECT 'payments' as tabela, * FROM payments 
WHERE document_id = '2780368c-8ef6-4424-9b90-34339adc414f';

-- Verificar se existem documentos com IDs similares ou filename relacionado
SELECT 'busca_por_user' as tipo, 'documents_to_be_verified' as tabela, * 
FROM documents_to_be_verified 
WHERE user_id = '6422b016-16a7-465a-a978-06f949c5c8b6'
ORDER BY created_at DESC;

SELECT 'busca_por_user' as tipo, 'documents' as tabela, * 
FROM documents 
WHERE user_id = '6422b016-16a7-465a-a978-06f949c5c8b6'
ORDER BY created_at DESC;
