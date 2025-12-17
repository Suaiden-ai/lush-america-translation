-- Correção da função is_lush_admin mantendo o parâmetro original
-- Execute este SQL para corrigir o erro

-- Primeiro, remover a função existente
DROP FUNCTION IF EXISTS is_lush_admin(uuid);

-- Recriar a função com o nome do parâmetro correto
CREATE OR REPLACE FUNCTION is_lush_admin(user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If no user_id provided, use current user
  IF user_id IS NULL THEN
    user_id := auth.uid();
  END IF;
  
  -- Check if user exists and has lush-admin OR finance role
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id 
    AND profiles.role IN ('lush-admin', 'finance')
  );
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION is_lush_admin(uuid) TO authenticated;
