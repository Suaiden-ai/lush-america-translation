-- Adicionar políticas RLS para a tabela payments

-- Primeiro, verificar se a tabela tem RLS habilitado
SELECT relname as table_name, relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'payments';

-- Habilitar RLS na tabela payments se ainda não estiver habilitado
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Finance users can view all payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;

-- Criar política para finance e lush-admin verem todos os pagamentos
CREATE POLICY "Finance users can view all payments" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('finance', 'lush-admin', 'admin')
    )
  );

-- Criar política para usuários verem seus próprios pagamentos
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Verificar as políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'payments';
