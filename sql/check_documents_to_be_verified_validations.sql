-- SQL para verificar todas as validações na tabela documents_to_be_verified

-- 1. Verificar constraints únicos na tabela documents_to_be_verified
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'documents_to_be_verified'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY', 'CHECK');

-- 2. Verificar todos os triggers na tabela documents_to_be_verified
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'documents_to_be_verified';

-- 3. Verificar funções que podem estar relacionadas à validação de duplicatas
SELECT 
    routine_name,
    routine_definition,
    routine_type
FROM information_schema.routines
WHERE routine_definition ILIKE '%documents_to_be_verified%'
    OR routine_definition ILIKE '%duplicate%'
    OR routine_definition ILIKE '%5 minutes%'
    OR routine_name ILIKE '%duplicate%'
    OR routine_name ILIKE '%check%';

-- 4. Verificar se há alguma função específica que valida duplicatas (P0001 error)
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%RAISE EXCEPTION%'
    AND (routine_definition ILIKE '%duplicate%' 
         OR routine_definition ILIKE '%same name%'
         OR routine_definition ILIKE '%5 minutes%');

-- 5. Verificar estrutura completa da tabela documents_to_be_verified
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'documents_to_be_verified'
ORDER BY ordinal_position;

-- 6. Verificar indexes na tabela documents_to_be_verified
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents_to_be_verified';

-- 7. Verificar se há alguma policy RLS que possa estar causando o erro
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'documents_to_be_verified';

-- 8. Verificar se há alguma regra (rule) na tabela
SELECT 
    rulename,
    definition
FROM pg_rules
WHERE tablename = 'documents_to_be_verified';

-- 9. Buscar por qualquer função que contenha a mensagem de erro específica
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%Duplicate document detected%';

-- 10. Verificar se há triggers BEFORE INSERT que podem estar validando
SELECT 
    t.trigger_name,
    t.action_timing,
    t.event_manipulation,
    p.prosrc as function_body
FROM information_schema.triggers t
JOIN pg_proc p ON p.proname = regexp_replace(t.action_statement, '.*EXECUTE (?:PROCEDURE|FUNCTION) ([^(]+).*', '\1')
WHERE t.event_object_table = 'documents_to_be_verified'
    AND t.action_timing = 'BEFORE'
    AND t.event_manipulation = 'INSERT';
