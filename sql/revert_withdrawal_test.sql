-- Script para reverter o teste de withdrawal
-- Este script restaura o tempo original das comissões

-- 1. Restaurar o tempo original das comissões (voltar 30 dias)
UPDATE affiliate_commissions 
SET 
    created_at = created_at + interval '30 days',
    available_for_withdrawal_at = available_for_withdrawal_at + interval '30 days'
WHERE affiliate_id = (
    SELECT id FROM affiliates 
    WHERE user_id = (
        SELECT id FROM profiles 
        WHERE email = 'crashroiali0@gmail.com'
    )
);

-- 2. Atualizar o saldo disponível para refletir o estado original
UPDATE affiliates 
SET available_balance = (
    SELECT available_balance 
    FROM get_affiliate_available_balance(affiliates.id)
)
WHERE id = (
    SELECT id FROM affiliates 
    WHERE user_id = (
        SELECT id FROM profiles 
        WHERE email = 'crashroiali0@gmail.com'
    )
);

-- 3. Verificar o estado final
SELECT 
    ac.id,
    ac.commission_amount,
    ac.status,
    ac.created_at,
    ac.available_for_withdrawal_at,
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

-- 4. Verificar saldo final
SELECT * FROM get_affiliate_available_balance(
    (SELECT id FROM affiliates 
     WHERE user_id = (
         SELECT id FROM profiles 
         WHERE email = 'crashroiali0@gmail.com'
     ))
);
