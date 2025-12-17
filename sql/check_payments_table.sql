-- Verificar se existem dados na tabela payments
SELECT COUNT(*) as total_payments FROM payments;

-- Verificar estrutura da tabela payments
SELECT * FROM payments LIMIT 1;

-- Verificar se há algum problema de permissão
SELECT has_table_privilege(current_user, 'payments', 'SELECT') as can_select,
       has_table_privilege(current_user, 'payments', 'INSERT') as can_insert;

-- Verificar se há políticas RLS na tabela payments
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'payments';
