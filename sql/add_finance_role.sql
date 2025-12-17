-- SQL simples para adicionar a role 'finance' ao enum user_role existente

-- Adicionar 'finance' como um novo valor ao enum user_role
ALTER TYPE user_role ADD VALUE 'finance';

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

-- Verificar os valores do enum após a adição
SELECT 
  enumtypid::regtype AS enum_name,
  enumlabel AS enum_value
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
