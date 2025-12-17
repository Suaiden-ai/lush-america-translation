-- SQL para verificar Storage Triggers que podem estar causando chamadas duplicadas

-- 1. Verificar se há hooks/triggers configurados no Storage do Supabase
-- (Isso não é visível via SQL padrão, mas podemos verificar indiretamente)

-- 2. Verificar se há funções que são chamadas automaticamente em uploads
SELECT 
    routine_name,
    routine_definition,
    routine_type
FROM information_schema.routines
WHERE routine_definition ILIKE '%storage%'
    OR routine_definition ILIKE '%upload%'
    OR routine_definition ILIKE '%webhook%'
    OR routine_name ILIKE '%storage%'
    OR routine_name ILIKE '%upload%'
    OR routine_name ILIKE '%webhook%';

-- 3. Verificar se há triggers que são executados em INSERT nas tabelas relacionadas
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('documents', 'documents_to_be_verified')
    AND event_manipulation = 'INSERT'
ORDER BY event_object_table, action_timing;

-- 4. Verificar se há alguma configuração de webhook automático
-- (Supabase pode ter configurações que não aparecem no schema padrão)

-- 5. Verificar se há políticas RLS que podem estar executando funções
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('documents', 'documents_to_be_verified')
ORDER BY tablename;

-- NOTA: Storage Triggers/Hooks do Supabase são configurados via Dashboard
-- e não aparecem necessariamente no schema SQL padrão.
-- Para verificar completamente, é necessário:
-- 1. Acessar Supabase Dashboard
-- 2. Ir para Storage > Settings/Hooks
-- 3. Verificar se há hooks configurados para chamar send-translation-webhook

SELECT 'Check Supabase Dashboard > Storage > Hooks for automatic webhook triggers' as next_step;
