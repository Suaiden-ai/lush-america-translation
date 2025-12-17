-- Script para atualizar documentos que foram processados manualmente
-- Estes documentos foram pagos na plataforma mas processados por fora
-- Vamos marcar como completed e autenticados pelo Luiz Bruno Nascimento Couto

-- 1. Primeiro, buscar o ID do autenticador Luiz Bruno Nascimento Couto
-- (Assumindo que o email ou nome está na tabela profiles)
DO $$
DECLARE
    luiz_authenticator_id UUID;
    doc1_id UUID;
    doc2_id UUID;
    doc3_id UUID;
    payment1_id UUID;
    payment2_id UUID;
    payment3_id UUID;
    dtbv1_id UUID;
    dtbv2_id UUID;
    dtbv3_id UUID;
BEGIN
    -- Buscar ID do autenticador Luiz Bruno Nascimento Couto
    -- Tentar por email primeiro, depois por nome
    SELECT id INTO luiz_authenticator_id
    FROM profiles
    WHERE (email ILIKE '%luiz%bruno%' 
       OR email ILIKE '%luiz%nascimento%'
       OR name ILIKE '%Luiz Bruno%'
       OR name ILIKE '%Luiz%Nascimento%'
       OR name ILIKE '%Luiz Bruno Nascimento Couto%')
       AND role = 'authenticator'
    LIMIT 1;
    
    -- Se não encontrar, tentar buscar qualquer autenticador com nome Luiz
    IF luiz_authenticator_id IS NULL THEN
        SELECT id INTO luiz_authenticator_id
        FROM profiles
        WHERE role = 'authenticator'
          AND (name ILIKE '%Luiz%' OR email ILIKE '%luiz%')
        LIMIT 1;
    END IF;
    
    -- Se ainda não encontrar, criar um log de erro
    IF luiz_authenticator_id IS NULL THEN
        RAISE WARNING 'Autenticador Luiz Bruno Nascimento Couto não encontrado. Verifique se existe um perfil com role=authenticator.';
    END IF;
    
    -- Se ainda não encontrar, usar um ID padrão ou criar um registro
    -- Por enquanto, vamos assumir que existe e fazer a busca pelos documentos
    
    -- 2. Buscar os documentos pelos filenames
    SELECT id INTO doc1_id
    FROM documents
    WHERE filename ILIKE '%certida_o_de_casamento_GC2GNN%'
       OR filename ILIKE '%GC2GNN%'
    LIMIT 1;
    
    SELECT id INTO doc2_id
    FROM documents
    WHERE filename ILIKE '%comprovante_residencia_brasil_adolfo_costa_HZBDQR%'
       OR filename ILIKE '%HZBDQR%'
    LIMIT 1;
    
    SELECT id INTO doc3_id
    FROM documents
    WHERE filename ILIKE '%hist_rico_escolar_YIX4NK%'
       OR filename ILIKE '%YIX4NK%'
    LIMIT 1;
    
    -- 3. Buscar os pagamentos relacionados
    IF doc1_id IS NOT NULL THEN
        SELECT id INTO payment1_id
        FROM payments
        WHERE document_id = doc1_id
        LIMIT 1;
    END IF;
    
    IF doc2_id IS NOT NULL THEN
        SELECT id INTO payment2_id
        FROM payments
        WHERE document_id = doc2_id
        LIMIT 1;
    END IF;
    
    IF doc3_id IS NOT NULL THEN
        SELECT id INTO payment3_id
        FROM payments
        WHERE document_id = doc3_id
        LIMIT 1;
    END IF;
    
    -- 4. Buscar documents_to_be_verified relacionados
    IF doc1_id IS NOT NULL THEN
        SELECT id INTO dtbv1_id
        FROM documents_to_be_verified
        WHERE original_document_id = doc1_id
        LIMIT 1;
    END IF;
    
    IF doc2_id IS NOT NULL THEN
        SELECT id INTO dtbv2_id
        FROM documents_to_be_verified
        WHERE original_document_id = doc2_id
        LIMIT 1;
    END IF;
    
    IF doc3_id IS NOT NULL THEN
        SELECT id INTO dtbv3_id
        FROM documents_to_be_verified
        WHERE original_document_id = doc3_id
        LIMIT 1;
    END IF;
    
    -- 5. Atualizar pagamentos para 'completed'
    IF payment1_id IS NOT NULL THEN
        UPDATE payments
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = payment1_id;
        
        RAISE NOTICE 'Pagamento 1 atualizado: %', payment1_id;
    END IF;
    
    IF payment2_id IS NOT NULL THEN
        UPDATE payments
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = payment2_id;
        
        RAISE NOTICE 'Pagamento 2 atualizado: %', payment2_id;
    END IF;
    
    IF payment3_id IS NOT NULL THEN
        UPDATE payments
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = payment3_id;
        
        RAISE NOTICE 'Pagamento 3 atualizado: %', payment3_id;
    END IF;
    
    -- 6. Atualizar documentos para 'completed' com dados do autenticador
    IF doc1_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        UPDATE documents
        SET status = 'completed',
            authenticated_by = luiz_authenticator_id,
            authenticated_by_name = 'Luiz Bruno Nascimento Couto',
            authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
            authentication_date = NOW(),
            updated_at = NOW()
        WHERE id = doc1_id;
        
        RAISE NOTICE 'Documento 1 atualizado: %', doc1_id;
    END IF;
    
    IF doc2_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        UPDATE documents
        SET status = 'completed',
            authenticated_by = luiz_authenticator_id,
            authenticated_by_name = 'Luiz Bruno Nascimento Couto',
            authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
            authentication_date = NOW(),
            updated_at = NOW()
        WHERE id = doc2_id;
        
        RAISE NOTICE 'Documento 2 atualizado: %', doc2_id;
    END IF;
    
    IF doc3_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        UPDATE documents
        SET status = 'completed',
            authenticated_by = luiz_authenticator_id,
            authenticated_by_name = 'Luiz Bruno Nascimento Couto',
            authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
            authentication_date = NOW(),
            updated_at = NOW()
        WHERE id = doc3_id;
        
        RAISE NOTICE 'Documento 3 atualizado: %', doc3_id;
    END IF;
    
    -- 7. Atualizar documents_to_be_verified
    IF dtbv1_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        UPDATE documents_to_be_verified
        SET status = 'completed',
            authenticated_by = luiz_authenticator_id,
            authenticated_by_name = 'Luiz Bruno Nascimento Couto',
            authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
            authentication_date = NOW(),
            updated_at = NOW()
        WHERE id = dtbv1_id;
    END IF;
    
    IF dtbv2_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        UPDATE documents_to_be_verified
        SET status = 'completed',
            authenticated_by = luiz_authenticator_id,
            authenticated_by_name = 'Luiz Bruno Nascimento Couto',
            authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
            authentication_date = NOW(),
            updated_at = NOW()
        WHERE id = dtbv2_id;
    END IF;
    
    IF dtbv3_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        UPDATE documents_to_be_verified
        SET status = 'completed',
            authenticated_by = luiz_authenticator_id,
            authenticated_by_name = 'Luiz Bruno Nascimento Couto',
            authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
            authentication_date = NOW(),
            updated_at = NOW()
        WHERE id = dtbv3_id;
    END IF;
    
    -- 8. Criar/atualizar registros em translated_documents
    IF dtbv1_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        -- Verificar se já existe
        IF EXISTS (SELECT 1 FROM translated_documents WHERE original_document_id = dtbv1_id) THEN
            UPDATE translated_documents
            SET status = 'completed',
                is_authenticated = true,
                authenticated_by = luiz_authenticator_id,
                authenticated_by_name = 'Luiz Bruno Nascimento Couto',
                authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
                authentication_date = NOW(),
                updated_at = NOW()
            WHERE original_document_id = dtbv1_id;
        ELSE
            -- Inserir novo registro
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
                'Luiz Bruno Nascimento Couto',
                (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
                NOW()
            FROM documents_to_be_verified dtbv
            WHERE dtbv.id = dtbv1_id;
        END IF;
    END IF;
    
    IF dtbv2_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM translated_documents WHERE original_document_id = dtbv2_id) THEN
            UPDATE translated_documents
            SET status = 'completed',
                is_authenticated = true,
                authenticated_by = luiz_authenticator_id,
                authenticated_by_name = 'Luiz Bruno Nascimento Couto',
                authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
                authentication_date = NOW(),
                updated_at = NOW()
            WHERE original_document_id = dtbv2_id;
        ELSE
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
                'Luiz Bruno Nascimento Couto',
                (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
                NOW()
            FROM documents_to_be_verified dtbv
            WHERE dtbv.id = dtbv2_id;
        END IF;
    END IF;
    
    IF dtbv3_id IS NOT NULL AND luiz_authenticator_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM translated_documents WHERE original_document_id = dtbv3_id) THEN
            UPDATE translated_documents
            SET status = 'completed',
                is_authenticated = true,
                authenticated_by = luiz_authenticator_id,
                authenticated_by_name = 'Luiz Bruno Nascimento Couto',
                authenticated_by_email = (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
                authentication_date = NOW(),
                updated_at = NOW()
            WHERE original_document_id = dtbv3_id;
        ELSE
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
                'Luiz Bruno Nascimento Couto',
                (SELECT email FROM profiles WHERE id = luiz_authenticator_id),
                NOW()
            FROM documents_to_be_verified dtbv
            WHERE dtbv.id = dtbv3_id;
        END IF;
    END IF;
    
    -- Log final
    RAISE NOTICE 'Processo concluído. Verifique os resultados acima.';
    
END $$;

-- Verificar os resultados
SELECT 
    d.id as document_id,
    d.filename,
    d.status as doc_status,
    d.authenticated_by_name,
    p.status as payment_status,
    p.amount as payment_amount,
    td.is_authenticated,
    td.status as translated_status
FROM documents d
LEFT JOIN payments p ON p.document_id = d.id
LEFT JOIN documents_to_be_verified dtbv ON dtbv.original_document_id = d.id
LEFT JOIN translated_documents td ON td.original_document_id = dtbv.id
WHERE d.filename ILIKE '%GC2GNN%'
   OR d.filename ILIKE '%HZBDQR%'
   OR d.filename ILIKE '%YIX4NK%';

