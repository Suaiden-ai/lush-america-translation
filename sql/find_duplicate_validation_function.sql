-- SQL específico para encontrar a função que valida duplicatas de documentos

-- 1. Buscar por qualquer função que contenha a mensagem de erro exata
SELECT 
    proname as function_name,
    prosrc as function_body,
    prorettype,
    proargtypes
FROM pg_proc
WHERE prosrc ILIKE '%Duplicate document detected%'
   OR prosrc ILIKE '%same name uploaded by same user within 5 minutes%';

-- 2. Buscar por triggers que executam antes de INSERT na tabela documents_to_be_verified
SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    p.prosrc as function_body
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'documents_to_be_verified'
    AND t.tgtype & 4 = 4  -- BEFORE trigger
    AND t.tgtype & 1 = 1; -- INSERT trigger

-- 3. Buscar por qualquer função que mencione validação de tempo (5 minutes)
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE prosrc ILIKE '%5 minutes%'
   OR prosrc ILIKE '%300%'  -- 5 minutes in seconds
   OR prosrc ILIKE '%interval%';

-- 4. Buscar por constraints CHECK que podem conter validação personalizada
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'documents_to_be_verified'
    AND c.contype = 'c';  -- CHECK constraint

-- 5. Verificar se há alguma função que use RAISE EXCEPTION
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE prosrc ILIKE '%RAISE EXCEPTION%'
    AND (prosrc ILIKE '%duplicate%' 
         OR prosrc ILIKE '%document%'
         OR prosrc ILIKE '%filename%'
         OR prosrc ILIKE '%user%');

-- 6. Buscar por qualquer função relacionada a documentos que possa estar validando
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE (proname ILIKE '%document%' OR proname ILIKE '%duplicate%' OR proname ILIKE '%check%')
    AND prosrc IS NOT NULL
    AND prosrc != '';
