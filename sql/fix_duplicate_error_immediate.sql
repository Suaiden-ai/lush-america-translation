-- SQL IMEDIATO para resolver o erro de documento duplicado
-- Execute este SQL no Supabase Dashboard -> SQL Editor

-- Remover o trigger que está causando o erro
DROP TRIGGER IF EXISTS prevent_duplicate_documents ON documents_to_be_verified;

-- Remover a função associada ao trigger
DROP FUNCTION IF EXISTS check_duplicate_documents() CASCADE;
DROP FUNCTION IF EXISTS prevent_duplicate_documents() CASCADE;

-- Verificar se foi removido com sucesso
SELECT 
    'SUCCESS: Duplicate validation removed' as status,
    COUNT(*) as remaining_triggers
FROM information_schema.triggers 
WHERE trigger_name = 'prevent_duplicate_documents' 
AND event_object_table = 'documents_to_be_verified';
