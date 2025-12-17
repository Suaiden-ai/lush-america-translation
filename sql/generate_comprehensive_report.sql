-- Função RPC para gerar relatórios detalhados de pagamentos e traduções
CREATE OR REPLACE FUNCTION generate_comprehensive_report(
  start_date timestamp DEFAULT NULL,
  end_date timestamp DEFAULT NULL,
  report_type text DEFAULT 'general'
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
  payment_data json;
  user_data json;
  document_data json;
  summary_data json;
BEGIN
  -- Se as datas não forem fornecidas, usar últimos 30 dias
  IF start_date IS NULL THEN
    start_date := NOW() - INTERVAL '30 days';
  END IF;
  
  IF end_date IS NULL THEN
    end_date := NOW();
  END IF;

  -- Dados de pagamentos detalhados
  WITH payment_details AS (
    SELECT 
      sp.id as payment_id,
      sp.session_id,
      sp.amount,
      sp.currency,
      sp.status as payment_status,
      sp.payment_date,
      sp.created_at as payment_created_at,
      d.id as document_id,
      d.document_name,
      d.status as document_status,
      d.is_bank_statement,
      d.tipo_trad,
      d.idioma_raiz,
      d.user_id,
      d.is_authenticated,
      d.total_cost,
      d.created_at as document_created_at,
      p.email as user_email,
      p.full_name as user_name,
      CASE 
        WHEN d.is_authenticated = true THEN 'Authenticator'
        ELSE 'Regular User'
      END as user_type
    FROM stripe_payments sp
    LEFT JOIN documents d ON d.session_id = sp.session_id
    LEFT JOIN profiles p ON p.id = d.user_id
    WHERE sp.created_at BETWEEN start_date AND end_date
      AND sp.status = 'completed'
  ),
  
  -- Resumo geral
  general_summary AS (
    SELECT 
      COUNT(*) as total_payments,
      SUM(amount) as total_revenue,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT document_id) as total_documents,
      AVG(amount) as avg_payment_amount,
      COUNT(CASE WHEN user_type = 'Regular User' THEN 1 END) as regular_user_payments,
      COUNT(CASE WHEN user_type = 'Authenticator' THEN 1 END) as authenticator_payments,
      SUM(CASE WHEN user_type = 'Regular User' THEN amount ELSE 0 END) as regular_user_revenue,
      SUM(CASE WHEN user_type = 'Authenticator' THEN amount ELSE 0 END) as authenticator_revenue
    FROM payment_details
  ),
  
  -- Breakdown por tipo de usuário
  user_type_breakdown AS (
    SELECT 
      user_type,
      COUNT(*) as payment_count,
      SUM(amount) as revenue,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(amount) as avg_payment,
      COUNT(DISTINCT document_id) as document_count
    FROM payment_details
    GROUP BY user_type
  ),
  
  -- Breakdown por tipo de tradução
  translation_type_breakdown AS (
    SELECT 
      COALESCE(tipo_trad, 'Not Specified') as translation_type,
      COUNT(*) as payment_count,
      SUM(amount) as revenue,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(amount) as avg_payment
    FROM payment_details
    GROUP BY tipo_trad
  ),
  
  -- Breakdown por idioma
  language_breakdown AS (
    SELECT 
      COALESCE(idioma_raiz, 'Not Specified') as source_language,
      COUNT(*) as payment_count,
      SUM(amount) as revenue,
      AVG(amount) as avg_payment
    FROM payment_details
    GROUP BY idioma_raiz
  ),
  
  -- Top users por revenue
  top_users AS (
    SELECT 
      user_email,
      user_name,
      user_type,
      COUNT(*) as total_payments,
      SUM(amount) as total_spent,
      AVG(amount) as avg_payment,
      MIN(payment_created_at) as first_payment,
      MAX(payment_created_at) as last_payment
    FROM payment_details
    WHERE user_email IS NOT NULL
    GROUP BY user_id, user_email, user_name, user_type
    ORDER BY total_spent DESC
    LIMIT 20
  ),
  
  -- Performance mensal
  monthly_performance AS (
    SELECT 
      DATE_TRUNC('month', payment_created_at) as month,
      COUNT(*) as payment_count,
      SUM(amount) as revenue,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(amount) as avg_payment
    FROM payment_details
    GROUP BY DATE_TRUNC('month', payment_created_at)
    ORDER BY month DESC
  ),
  
  -- Documentos por status
  document_status_breakdown AS (
    SELECT 
      document_status,
      COUNT(*) as document_count,
      SUM(amount) as revenue,
      COUNT(CASE WHEN is_bank_statement = true THEN 1 END) as bank_statements
    FROM payment_details
    WHERE document_id IS NOT NULL
    GROUP BY document_status
  )

  SELECT json_build_object(
    'report_metadata', json_build_object(
      'generated_at', NOW(),
      'period_start', start_date,
      'period_end', end_date,
      'report_type', report_type
    ),
    'summary', (SELECT row_to_json(s) FROM general_summary s LIMIT 1),
    'user_type_breakdown', (
      SELECT json_agg(row_to_json(utb))
      FROM user_type_breakdown utb
    ),
    'translation_type_breakdown', (
      SELECT json_agg(row_to_json(ttb))
      FROM translation_type_breakdown ttb
    ),
    'language_breakdown', (
      SELECT json_agg(row_to_json(lb))
      FROM language_breakdown lb
    ),
    'top_users', (
      SELECT json_agg(row_to_json(tu))
      FROM top_users tu
    ),
    'monthly_performance', (
      SELECT json_agg(row_to_json(mp))
      FROM monthly_performance mp
    ),
    'document_status_breakdown', (
      SELECT json_agg(row_to_json(dsb))
      FROM document_status_breakdown dsb
    ),
    'detailed_payments', (
      SELECT json_agg(row_to_json(pd))
      FROM payment_details pd
      ORDER BY pd.payment_created_at DESC
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
