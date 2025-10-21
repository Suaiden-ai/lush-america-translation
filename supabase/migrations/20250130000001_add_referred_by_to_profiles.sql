-- Add referred_by_code field to profiles table
ALTER TABLE profiles 
ADD COLUMN referred_by_code text;

-- Add comment
COMMENT ON COLUMN profiles.referred_by_code IS 'Código do afiliado que indicou este usuário';
