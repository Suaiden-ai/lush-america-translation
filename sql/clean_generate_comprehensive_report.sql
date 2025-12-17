-- Remover todas as versões existentes da função e criar uma nova versão única
DROP FUNCTION IF EXISTS generate_comprehensive_report(timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS generate_comprehensive_report(timestamp, timestamp, text);
DROP FUNCTION IF EXISTS generate_comprehensive_report();

-- Função RPC para gerar relatórios detalhados de pagamentos e traduções (versão limpa)
CREATE OR REPLACE FUNCTION generate_comprehensive_report(
  p_start_date timestamp DEFAULT NULL,
  p_end_date timestamp DEFAULT NULL,
  p_report_type text DEFAULT 'general'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_start_date timestamp;
  v_end_date timestamp;
BEGIN
  -- Se as datas não forem fornecidas, usar últimos 30 dias
  IF p_start_date IS NULL THEN
    v_start_date := NOW() - INTERVAL '30 days';
  ELSE
    v_start_date := p_start_date;
  END IF;
  
  IF p_end_date IS NULL THEN
    v_end_date := NOW();
  ELSE
    v_end_date := p_end_date;
  END IF;

  -- Dados de pagamentos detalhados usando a tabela payments
  WITH payment_details AS (
    SELECT 
      p.id as payment_id,
      COALESCE(p.stripe_session_id, '') as stripe_session_id,
      COALESCE(p.amount, 0) as amount,
      COALESCE(p.currency, 'USD') as currency,
      COALESCE(p.status, 'unknown') as payment_status,
      p.payment_date,
      p.created_at as payment_created_at,
      COALESCE(d.id, p.document_id) as document_id,
      COALESCE(d.filename, 'Documento não encontrado') as document_name,
      COALESCE(d.status::text, 'unknown') as document_status,
      COALESCE(d.is_bank_statement, false) as is_bank_statement,
      COALESCE(d.tipo_trad, 'Não especificado') as translation_type,
      COALESCE(d.idioma_raiz, 'Não especificado') as source_language,
      'English' as target_language, -- Assumindo inglês como padrão
      COALESCE(p.user_id, d.user_id) as user_id,
      COALESCE(d.total_cost, 0) as total_cost,
      d.created_at as document_created_at,
      COALESCE(pr.email, 'Email não disponível') as user_email,
      COALESCE(pr.name, 'Nome não disponível') as user_name,
      CASE 
        WHEN pr.role = 'authenticator' THEN 'Authenticator'
        ELSE 'Regular User'
      END as user_type
    FROM payments p
    LEFT JOIN documents d ON d.id = p.document_id
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE p.payment_date::timestamp BETWEEN v_start_date AND v_end_date
      AND p.status = 'completed'
  ),
  
  -- Resumo geral
  general_summary AS (
    SELECT 
      COUNT(*) as total_payments,
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT document_id) as total_documents,
      COALESCE(AVG(amount), 0) as avg_payment_amount,
      COUNT(CASE WHEN user_type = 'Regular User' THEN 1 END) as regular_user_payments,
      COUNT(CASE WHEN user_type = 'Authenticator' THEN 1 END) as authenticator_payments,
      COALESCE(SUM(CASE WHEN user_type = 'Regular User' THEN amount ELSE 0 END), 0) as regular_user_revenue,
      COALESCE(SUM(CASE WHEN user_type = 'Authenticator' THEN amount ELSE 0 END), 0) as authenticator_revenue
    FROM payment_details
  ),
  
  -- Breakdown por tipo de usuário
  user_type_breakdown AS (
    SELECT 
      json_agg(
        json_build_object(
          'user_type', user_type,
          'payment_count', payment_count,
          'revenue', revenue,
          'unique_users', unique_users,
          'avg_payment', avg_payment
        )
      ) as data
    FROM (
      SELECT 
        user_type,
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(DISTINCT user_id) as unique_users,
        COALESCE(AVG(amount), 0) as avg_payment
      FROM payment_details
      GROUP BY user_type
    ) ut
  ),
  
  -- Breakdown por tipo de tradução
  translation_type_breakdown AS (
    SELECT 
      json_agg(
        json_build_object(
          'translation_type', translation_type,
          'payment_count', payment_count,
          'revenue', revenue,
          'unique_users', unique_users
        )
      ) as data
    FROM (
      SELECT 
        COALESCE(translation_type, 'Não especificado') as translation_type,
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(DISTINCT user_id) as unique_users
      FROM payment_details
      GROUP BY translation_type
      ORDER BY revenue DESC
    ) tt
  ),
  
  -- Breakdown por idiomas
  language_breakdown AS (
    SELECT 
      json_agg(
        json_build_object(
          'source_language', source_language,
          'target_language', target_language,
          'payment_count', payment_count,
          'revenue', revenue
        )
      ) as data
    FROM (
      SELECT 
        COALESCE(source_language, 'Não especificado') as source_language,
        COALESCE(target_language, 'Não especificado') as target_language,
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as revenue
      FROM payment_details
      GROUP BY source_language, target_language
      ORDER BY revenue DESC
      LIMIT 20
    ) lb
  ),
  
  -- Top usuários por receita
  top_users AS (
    SELECT 
      json_agg(
        json_build_object(
          'user_name', user_name,
          'user_email', user_email,
          'user_type', user_type,
          'total_payments', payment_count,
          'total_revenue', revenue,
          'avg_payment', avg_payment
        )
      ) as data
    FROM (
      SELECT 
        COALESCE(user_name, 'Nome não disponível') as user_name,
        COALESCE(user_email, 'Email não disponível') as user_email,
        user_type,
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as revenue,
        COALESCE(AVG(amount), 0) as avg_payment
      FROM payment_details
      WHERE user_id IS NOT NULL
      GROUP BY user_id, user_name, user_email, user_type
      ORDER BY revenue DESC
      LIMIT 50
    ) tu
  ),
  
  -- Performance mensal
  monthly_performance AS (
    SELECT 
      json_agg(
        json_build_object(
          'month', month_year,
          'payment_count', payment_count,
          'revenue', revenue,
          'unique_users', unique_users
        ) ORDER BY month_year
      ) as data
    FROM (
      SELECT 
        TO_CHAR(payment_date::timestamp, 'YYYY-MM') as month_year,
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(DISTINCT user_id) as unique_users
      FROM payment_details
      GROUP BY TO_CHAR(payment_date::timestamp, 'YYYY-MM')
      ORDER BY month_year
    ) mp
  ),
  
  -- Status dos documentos
  document_status_breakdown AS (
    SELECT 
      json_agg(
        json_build_object(
          'document_status', document_status,
          'payment_count', payment_count,
          'revenue', revenue
        )
      ) as data
    FROM (
      SELECT 
        COALESCE(document_status, 'Status não disponível') as document_status,
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as revenue
      FROM payment_details
      GROUP BY document_status
      ORDER BY payment_count DESC
    ) ds
  ),

  -- Pagamentos detalhados (amostra)
  detailed_payments AS (
    SELECT 
      json_agg(
        json_build_object(
          'payment_id', payment_id,
          'amount', amount,
          'currency', currency,
          'payment_status', payment_status,
          'payment_date', payment_date,
          'user_name', user_name,
          'user_email', user_email,
          'user_type', user_type,
          'document_name', document_name,
          'translation_type', translation_type,
          'source_language', source_language,
          'target_language', target_language,
          'is_bank_statement', is_bank_statement
        ) ORDER BY payment_date DESC
      ) as data
    FROM (
      SELECT *
      FROM payment_details
      ORDER BY payment_date DESC
      LIMIT 500  -- Limitar para não sobrecarregar
    ) dp
  )

  SELECT json_build_object(
    'report_metadata', json_build_object(
      'generated_at', NOW(),
      'start_date', v_start_date,
      'end_date', v_end_date,
      'report_type', p_report_type
    ),
    'general_summary', (SELECT row_to_json(g) FROM general_summary g),
    'user_type_breakdown', (SELECT data FROM user_type_breakdown),
    'translation_type_breakdown', (SELECT data FROM translation_type_breakdown),
    'language_breakdown', (SELECT data FROM language_breakdown),
    'top_users', (SELECT data FROM top_users),
    'monthly_performance', (SELECT data FROM monthly_performance),
    'document_status_breakdown', (SELECT data FROM document_status_breakdown),
    'detailed_payments', (SELECT data FROM detailed_payments)
  ) INTO result;

  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, retornar informações sobre o erro
    RETURN json_build_object(
      'error', true,
      'message', SQLERRM,
      'code', SQLSTATE,
      'generated_at', NOW()
    );
END;
$$;
