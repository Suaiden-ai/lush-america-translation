-- Script para testar o sistema de withdrawal automático
-- Este script adianta o tempo das comissões para simular que já passaram 30 dias

-- 1. Verificar comissões atuais do usuário
SELECT 
    ac.id,
    ac.affiliate_id,
    ac.commission_amount,
    ac.status,
    ac.created_at,
    ac.available_for_withdrawal_at,
    ac.withdrawn_amount,
    (ac.available_for_withdrawal_at <= now()) as is_available_now,
    (ac.available_for_withdrawal_at - now()) as time_until_available
FROM affiliate_commissions ac
WHERE ac.affiliate_id = (
    SELECT id FROM affiliates 
    WHERE user_id = (
        SELECT id FROM profiles 
        WHERE email = 'crashroiali0@gmail.com'
    )
)
ORDER BY ac.created_at DESC;

-- 2. Adiantar o tempo das comissões para 30 dias atrás (simular que já passaram 30 dias)
UPDATE affiliate_commissions 
SET 
    created_at = created_at - interval '30 days',
    available_for_withdrawal_at = available_for_withdrawal_at - interval '30 days'
WHERE affiliate_id = (
    SELECT id FROM affiliates 
    WHERE user_id = (
        SELECT id FROM profiles 
        WHERE email = 'crashroiali0@gmail.com'
    )
);

-- 3. Verificar se as comissões agora estão disponíveis
SELECT 
    ac.id,
    ac.affiliate_id,
    ac.commission_amount,
    ac.status,
    ac.created_at,
    ac.available_for_withdrawal_at,
    ac.withdrawn_amount,
    (ac.available_for_withdrawal_at <= now()) as is_available_now,
    (ac.available_for_withdrawal_at - now()) as time_until_available
FROM affiliate_commissions ac
WHERE affiliate_id = (
    SELECT id FROM affiliates 
    WHERE user_id = (
        SELECT id FROM profiles 
        WHERE email = 'crashroiali0@gmail.com'
    )
)
ORDER BY ac.created_at DESC;

-- 4. Verificar o saldo disponível usando a função
SELECT * FROM get_affiliate_available_balance(
    (SELECT id FROM affiliates 
     WHERE user_id = (
         SELECT id FROM profiles 
         WHERE email = 'crashroiali0@gmail.com'
     ))
);

-- 5. Verificar se o afiliado pode fazer saque
SELECT 
    a.id,
    a.user_id,
    a.available_balance,
    a.pending_balance,
    a.can_request_withdrawal,
    a.next_withdrawal_date,
    p.name,
    p.email
FROM affiliates a
JOIN profiles p ON p.id = a.user_id
WHERE p.email = 'crashroiali0@gmail.com';
