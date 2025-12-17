-- Script completo para migrar e limpar o enum user_role
-- Execute este script no Supabase SQL Editor após o fix_enum_migration.sql

-- Criar enum limpo sem 'lush-admin'
CREATE TYPE user_role_clean AS ENUM ('user', 'admin', 'authenticator', 'finance');

-- Atualizar a tabela profiles para usar o novo enum
ALTER TABLE profiles 
ALTER COLUMN role TYPE user_role_clean USING role::text::user_role_clean;

-- Remover o enum antigo e renomear o novo
DROP TYPE user_role;
ALTER TYPE user_role_clean RENAME TO user_role;

-- Verificar o resultado final
SELECT 
  enumtypid::regtype AS enum_name,
  enumlabel AS enum_value
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
