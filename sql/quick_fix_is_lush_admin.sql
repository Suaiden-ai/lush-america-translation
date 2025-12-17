-- Correção rápida: atualizar is_lush_admin para aceitar finance
CREATE OR REPLACE FUNCTION is_lush_admin(user_id_param uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If no user_id provided, use current user
  IF user_id_param IS NULL THEN
    user_id_param := auth.uid();
  END IF;
  
  -- Check if user exists and has lush-admin OR finance role
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id_param 
    AND profiles.role IN ('lush-admin', 'finance')
  );
END;
$$;
