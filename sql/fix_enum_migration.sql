-- Script para corrigir a migração do enum user_role
-- Execute este script no Supabase SQL Editor

-- Primeiro, adicione 'finance' ao enum existente
ALTER TYPE user_role ADD VALUE 'finance';

-- Agora atualize os usuários lush-admin para finance
UPDATE profiles 
SET role = 'finance' 
WHERE role = 'lush-admin';

-- Criar nova função is_finance
CREATE OR REPLACE FUNCTION is_finance(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = COALESCE(user_id, auth.uid()) 
    AND role = 'finance'
  );
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION is_finance(UUID) TO authenticated;

-- Remover função antiga
DROP FUNCTION IF EXISTS is_lush_admin(UUID);

-- Verificar se a migração funcionou
SELECT role, COUNT(*) 
FROM profiles 
GROUP BY role;
