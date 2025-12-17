-- PASSO 1: Adicionar a role 'finance' ao enum user_role
-- Execute este SQL primeiro e aguarde o commit

-- Adicionar 'finance' como um novo valor ao enum user_role
ALTER TYPE user_role ADD VALUE 'finance';

-- Verificar os valores do enum após a adição
SELECT 
  enumtypid::regtype AS enum_name,
  enumlabel AS enum_value
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
