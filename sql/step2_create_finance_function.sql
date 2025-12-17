-- PASSO 2: Criar função e migrar usuários
-- Execute este SQL APÓS o passo 1 ter sido commitado

-- Criar função para verificar se o usuário tem role finance
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

-- Conceder permissões para a função
GRANT EXECUTE ON FUNCTION is_finance(UUID) TO authenticated;

-- Opcional: Migrar usuários de lush-admin para finance
-- Descomente a linha abaixo se quiser migrar automaticamente
-- UPDATE profiles SET role = 'finance' WHERE role = 'lush-admin';

-- Verificar se tudo funcionou
SELECT role, COUNT(*) as count
FROM profiles 
GROUP BY role
ORDER BY role;
