-- Script simplificado para atualizar documentos processados manualmente
-- Documentos pagos na plataforma mas processados por fora
-- Marcar como completed e autenticados pelo Luiz Eduardo Miola

-- ============================================
-- PASSO 1: Buscar o ID do autenticador Luiz Eduardo Miola
-- ============================================
DO $$
DECLARE
    luiz_authenticator_id UUID;
    luiz_email TEXT;
    luiz_name TEXT;
BEGIN
    -- Buscar ID do autenticador Luiz Eduardo Miola
    SELECT id, email, name INTO luiz_authenticator_id, luiz_email, luiz_name
    FROM profiles
    WHERE role = 'authenticator'
      AND (
        email = 'luizeduardomcsantos@gmail.com'
        OR name ILIKE '%Luiz Eduardo Miola%'
        OR (name ILIKE '%Luiz Eduardo%' AND email ILIKE '%luizeduardo%')
      )
    LIMIT 1;
    
    IF luiz_authenticator_id IS NULL THEN
        RAISE EXCEPTION 'Autenticador Luiz Eduardo Miola (luizeduardomcsantos@gmail.com) não encontrado. Verifique se existe um perfil com role=authenticator.';
    END IF;
    
    RAISE NOTICE 'Autenticador encontrado: ID=%, Nome=%, Email=%', luiz_authenticator_id, luiz_name, luiz_email;
    
    -- ============================================
    -- PASSO 2: Atualizar pagamentos para 'completed'
    -- ============================================
    
    -- Documento 1: Bruno Couto - certida_o_de_casamento_GC2GNN.jpg
    UPDATE payments
    SET status = 'completed',
        updated_at = NOW()
    WHERE id IN (
        SELECT p.id
        FROM payments p
        JOIN documents d ON d.id = p.document_id
        JOIN profiles pr ON pr.id = d.user_id
        WHERE pr.email = 'bruno_couto1996@hotmail.com'
          AND (d.filename ILIKE '%GC2GNN%' OR d.filename ILIKE '%certida_o_de_casamento%')
          AND p.status = 'pending'
    );
    
    -- Documento 2: Adolfo Cezar - comprovante_residencia_brasil_adolfo_costa_HZBDQR.pdf
    UPDATE payments
    SET status = 'completed',
        updated_at = NOW()
    WHERE id IN (
        SELECT p.id
        FROM payments p
        JOIN documents d ON d.id = p.document_id
        JOIN profiles pr ON pr.id = d.user_id
        WHERE pr.email = 'adolfocezarcosta@gmail.com'
          AND (d.filename ILIKE '%HZBDQR%' OR d.filename ILIKE '%comprovante_residencia%')
          AND p.status = 'pending'
    );
    
    -- Documento 3: Luiz Eduardo - hist_rico_escolar_YIX4NK
    UPDATE payments
    SET status = 'completed',
        updated_at = NOW()
    WHERE id IN (
        SELECT p.id
        FROM payments p
        JOIN documents d ON d.id = p.document_id
        JOIN profiles pr ON pr.id = d.user_id
        WHERE pr.email = 'luizeduardogouveia7@gmail.com'
          AND (d.filename ILIKE '%YIX4NK%' OR d.filename ILIKE '%hist_rico_escolar%')
          AND p.status = 'pending'
    );
    
    RAISE NOTICE 'Pagamentos atualizados para completed';
    
    -- ============================================
    -- PASSO 3: Atualizar documentos para 'completed' com dados do autenticador
    -- ============================================
    
    -- Documento 1: Bruno Couto
    UPDATE documents
    SET status = 'completed',
        authenticated_by = luiz_authenticator_id,
        authenticated_by_name = COALESCE(luiz_name, 'Luiz Eduardo Miola'),
        authenticated_by_email = luiz_email,
        authentication_date = NOW(),
        updated_at = NOW()
    WHERE id IN (
        SELECT d.id
        FROM documents d
        JOIN profiles pr ON pr.id = d.user_id
        WHERE pr.email = 'bruno_couto1996@hotmail.com'
          AND (d.filename ILIKE '%GC2GNN%' OR d.filename ILIKE '%certida_o_de_casamento%')
    );
    
    -- Documento 2: Adolfo Cezar
    UPDATE documents
    SET status = 'completed',
        authenticated_by = luiz_authenticator_id,
        authenticated_by_name = COALESCE(luiz_name, 'Luiz Eduardo Miola'),
        authenticated_by_email = luiz_email,
        authentication_date = NOW(),
        updated_at = NOW()
    WHERE id IN (
        SELECT d.id
        FROM documents d
        JOIN profiles pr ON pr.id = d.user_id
        WHERE pr.email = 'adolfocezarcosta@gmail.com'
          AND (d.filename ILIKE '%HZBDQR%' OR d.filename ILIKE '%comprovante_residencia%')
    );
    
    -- Documento 3: Luiz Eduardo
    UPDATE documents
    SET status = 'completed',
        authenticated_by = luiz_authenticator_id,
        authenticated_by_name = COALESCE(luiz_name, 'Luiz Eduardo Miola'),
        authenticated_by_email = luiz_email,
        authentication_date = NOW(),
        updated_at = NOW()
    WHERE id IN (
        SELECT d.id
        FROM documents d
        JOIN profiles pr ON pr.id = d.user_id
        WHERE pr.email = 'luizeduardogouveia7@gmail.com'
          AND (d.filename ILIKE '%YIX4NK%' OR d.filename ILIKE '%hist_rico_escolar%')
    );
    
    RAISE NOTICE 'Documentos atualizados para completed com dados do autenticador';
    
    -- ============================================
    -- PASSO 4: Atualizar documents_to_be_verified
    -- ============================================
    
    UPDATE documents_to_be_verified
    SET status = 'completed',
        authenticated_by = luiz_authenticator_id,
        authenticated_by_name = COALESCE(luiz_name, 'Luiz Eduardo Miola'),
        authenticated_by_email = luiz_email,
        authentication_date = NOW(),
        updated_at = NOW()
    WHERE original_document_id IN (
        SELECT d.id
        FROM documents d
        JOIN profiles pr ON pr.id = d.user_id
        WHERE (
            (pr.email = 'bruno_couto1996@hotmail.com' AND (d.filename ILIKE '%GC2GNN%' OR d.filename ILIKE '%certida_o_de_casamento%'))
            OR (pr.email = 'adolfocezarcosta@gmail.com' AND (d.filename ILIKE '%HZBDQR%' OR d.filename ILIKE '%comprovante_residencia%'))
            OR (pr.email = 'luizeduardogouveia7@gmail.com' AND (d.filename ILIKE '%YIX4NK%' OR d.filename ILIKE '%hist_rico_escolar%'))
        )
    );
    
    RAISE NOTICE 'Documents_to_be_verified atualizados';
    
    -- ============================================
    -- PASSO 5: Criar/atualizar registros em translated_documents
    -- ============================================
    
    -- Para cada documento, atualizar se existir, senão criar registro em translated_documents
    
    -- Primeiro, atualizar os que já existem
    UPDATE translated_documents
    SET status = 'completed',
        is_authenticated = true,
        authenticated_by = luiz_authenticator_id,
        authenticated_by_name = COALESCE(luiz_name, 'Luiz Eduardo Miola'),
        authenticated_by_email = luiz_email,
        authentication_date = NOW(),
        updated_at = NOW()
    WHERE original_document_id IN (
        SELECT dtbv.id
        FROM documents_to_be_verified dtbv
        JOIN documents d ON d.id = dtbv.original_document_id
        JOIN profiles pr ON pr.id = d.user_id
        WHERE (
            (pr.email = 'bruno_couto1996@hotmail.com' AND (d.filename ILIKE '%GC2GNN%' OR d.filename ILIKE '%certida_o_de_casamento%'))
            OR (pr.email = 'adolfocezarcosta@gmail.com' AND (d.filename ILIKE '%HZBDQR%' OR d.filename ILIKE '%comprovante_residencia%'))
            OR (pr.email = 'luizeduardogouveia7@gmail.com' AND (d.filename ILIKE '%YIX4NK%' OR d.filename ILIKE '%hist_rico_escolar%'))
        )
    );
    
    -- Depois, inserir os que não existem
    INSERT INTO translated_documents (
        original_document_id,
        user_id,
        filename,
        translated_file_url,
        source_language,
        target_language,
        pages,
        status,
        total_cost,
        verification_code,
        is_authenticated,
        authenticated_by,
        authenticated_by_name,
        authenticated_by_email,
        authentication_date
    )
    SELECT 
        dtbv.id,
        dtbv.user_id,
        dtbv.filename,
        COALESCE(dtbv.file_url, dtbv.translated_file_url, ''),
        COALESCE(dtbv.source_language, 'portuguese'),
        COALESCE(dtbv.target_language, 'english'),
        COALESCE(dtbv.pages, 1),
        'completed',
        COALESCE(dtbv.total_cost, 0),
        COALESCE(dtbv.verification_code, gen_random_uuid()::text),
        true,
        luiz_authenticator_id,
        COALESCE(luiz_name, 'Luiz Eduardo Miola'),
        luiz_email,
        NOW()
    FROM documents_to_be_verified dtbv
    JOIN documents d ON d.id = dtbv.original_document_id
    JOIN profiles pr ON pr.id = d.user_id
    WHERE (
        (pr.email = 'bruno_couto1996@hotmail.com' AND (d.filename ILIKE '%GC2GNN%' OR d.filename ILIKE '%certida_o_de_casamento%'))
        OR (pr.email = 'adolfocezarcosta@gmail.com' AND (d.filename ILIKE '%HZBDQR%' OR d.filename ILIKE '%comprovante_residencia%'))
        OR (pr.email = 'luizeduardogouveia7@gmail.com' AND (d.filename ILIKE '%YIX4NK%' OR d.filename ILIKE '%hist_rico_escolar%'))
    )
    AND NOT EXISTS (
        SELECT 1 FROM translated_documents td WHERE td.original_document_id = dtbv.id
    );
    
    RAISE NOTICE 'Translated_documents criados/atualizados';
    RAISE NOTICE 'Processo concluído com sucesso!';
    
END $$;

-- ============================================
-- VERIFICAÇÃO: Ver os resultados
-- ============================================
SELECT 
    pr.name as user_name,
    pr.email as user_email,
    d.filename,
    d.status as doc_status,
    d.authenticated_by_name,
    d.authentication_date,
    p.status as payment_status,
    p.amount as payment_amount,
    td.is_authenticated,
    td.status as translated_status
FROM documents d
JOIN profiles pr ON pr.id = d.user_id
LEFT JOIN payments p ON p.document_id = d.id
LEFT JOIN documents_to_be_verified dtbv ON dtbv.original_document_id = d.id
LEFT JOIN translated_documents td ON td.original_document_id = dtbv.id
WHERE pr.email IN ('bruno_couto1996@hotmail.com', 'adolfocezarcosta@gmail.com', 'luizeduardogouveia7@gmail.com')
  AND (
    d.filename ILIKE '%GC2GNN%' 
    OR d.filename ILIKE '%HZBDQR%' 
    OR d.filename ILIKE '%YIX4NK%'
  )
ORDER BY pr.email, d.created_at;

