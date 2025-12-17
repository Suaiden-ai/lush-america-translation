-- Verificar configuração atual

-- 1. Verificar se há dados na tabela
SELECT COUNT(*) as total_payments FROM payments;

-- 2. Verificar as foreign keys
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'payments'
AND tc.constraint_type = 'FOREIGN KEY';

-- 3. Verificar se as tabelas relacionadas têm dados
SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'documents' as table_name, COUNT(*) as count FROM documents;

-- 4. Testar a consulta que o frontend está usando
SELECT p.*,
       pr.email as user_email,
       pr.name as user_name,
       d.filename as document_filename
FROM payments p
LEFT JOIN profiles pr ON p.user_id = pr.id
LEFT JOIN documents d ON p.document_id = d.id
ORDER BY p.created_at DESC
LIMIT 5;
