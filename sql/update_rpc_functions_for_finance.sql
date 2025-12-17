-- Atualizar funções RPC para aceitar role 'finance' além de 'lush-admin'
-- Execute este SQL após criar a role 'finance'

-- 1. Atualizar função is_lush_admin para aceitar finance também
CREATE OR REPLACE FUNCTION is_lush_admin(user_id_param uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If no user_id provided, use current user
  IF user_id_param IS NULL THEN
    user_id_param := auth.uid();
  END IF;
  
  -- Check if user exists and has lush-admin OR finance role
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id_param 
    AND profiles.role IN ('lush-admin', 'finance')
  );
END;
$$;

-- 2. Atualizar as mensagens de erro para incluir finance
CREATE OR REPLACE FUNCTION get_payment_stats(start_date text DEFAULT NULL, end_date text DEFAULT NULL)
RETURNS TABLE(
  total_payments bigint,
  total_amount numeric,
  completed_payments bigint,
  pending_payments bigint,
  failed_payments bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is lush-admin or finance
  IF NOT is_lush_admin() THEN
    RAISE EXCEPTION 'Access denied. Only lush-admin users can access payment statistics.';
  END IF;
  
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_payments,
    COALESCE(SUM(amount), 0) as total_amount,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_payments,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint as failed_payments
  FROM payments
  WHERE 
    (start_date IS NULL OR created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR created_at <= end_date::timestamptz);
END;
$$;

-- 3. Atualizar get_translation_stats
CREATE OR REPLACE FUNCTION get_translation_stats(start_date text DEFAULT NULL, end_date text DEFAULT NULL)
RETURNS TABLE(
  total_documents bigint,
  completed_translations bigint,
  pending_translations bigint,
  total_revenue numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is lush-admin or finance
  IF NOT is_lush_admin() THEN
    RAISE EXCEPTION 'Access denied. Only lush-admin users can access translation statistics.';
  END IF;
  
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_translations,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_translations,
    COALESCE(SUM(total_cost), 0) as total_revenue
  FROM documents_to_be_verified
  WHERE 
    (start_date IS NULL OR created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR created_at <= end_date::timestamptz);
END;
$$;

-- 4. Atualizar get_enhanced_translation_stats
CREATE OR REPLACE FUNCTION get_enhanced_translation_stats(start_date text DEFAULT NULL, end_date text DEFAULT NULL)
RETURNS TABLE(
  -- Overall totals
  total_documents bigint,
  total_revenue numeric,
  
  -- User uploads (regular customers)
  user_uploads_total bigint,
  user_uploads_completed bigint,
  user_uploads_pending bigint,
  user_uploads_revenue numeric,
  
  -- Authenticator uploads
  authenticator_uploads_total bigint,
  authenticator_uploads_completed bigint,
  authenticator_uploads_pending bigint,
  authenticator_uploads_revenue numeric,
  
  -- Processing status breakdown
  total_completed bigint,
  total_pending bigint,
  total_processing bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is lush-admin or finance
  IF NOT is_lush_admin() THEN
    RAISE EXCEPTION 'Access denied. Only lush-admin users can access this function.';
  END IF;
  
  RETURN QUERY
  WITH user_stats AS (
    -- Statistics for regular user uploads
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending,
      COALESCE(SUM(total_cost), 0) as revenue
    FROM documents_to_be_verified dtv
    JOIN profiles p ON dtv.user_id = p.id
    WHERE p.role = 'user'
      AND (start_date IS NULL OR dtv.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR dtv.created_at <= end_date::timestamptz)
  ),
  authenticator_stats AS (
    -- Statistics for authenticator uploads
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending,
      COALESCE(SUM(total_cost), 0) as revenue
    FROM documents_to_be_verified dtv
    JOIN profiles p ON dtv.user_id = p.id
    WHERE p.role = 'authenticator'
      AND (start_date IS NULL OR dtv.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR dtv.created_at <= end_date::timestamptz)
  ),
  overall_stats AS (
    -- Overall statistics
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending,
      COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing,
      COALESCE(SUM(total_cost), 0) as revenue
    FROM documents_to_be_verified dtv
    WHERE (start_date IS NULL OR dtv.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR dtv.created_at <= end_date::timestamptz)
  )
  SELECT 
    -- Overall totals
    os.total as total_documents,
    os.revenue as total_revenue,
    
    -- User uploads
    us.total as user_uploads_total,
    us.completed as user_uploads_completed,
    us.pending as user_uploads_pending,
    us.revenue as user_uploads_revenue,
    
    -- Authenticator uploads
    aus.total as authenticator_uploads_total,
    aus.completed as authenticator_uploads_completed,
    aus.pending as authenticator_uploads_pending,
    aus.revenue as authenticator_uploads_revenue,
    
    -- Processing status breakdown
    os.completed as total_completed,
    os.pending as total_pending,
    os.processing as total_processing
  FROM user_stats us, authenticator_stats aus, overall_stats os;
END;
$$;

-- 5. Atualizar get_user_type_breakdown
CREATE OR REPLACE FUNCTION get_user_type_breakdown(start_date text DEFAULT NULL, end_date text DEFAULT NULL)
RETURNS TABLE(
  user_type text,
  total_documents bigint,
  completed_documents bigint,
  pending_documents bigint,
  processing_documents bigint,
  total_revenue numeric,
  avg_revenue_per_doc numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is lush-admin or finance
  IF NOT is_lush_admin() THEN
    RAISE EXCEPTION 'Access denied. Only lush-admin users can access this function.';
  END IF;
  
  RETURN QUERY
  SELECT 
    'Regular Users'::text as user_type,
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_documents,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_documents,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing_documents,
    COALESCE(SUM(total_cost), 0) as total_revenue,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_cost), 0) / COUNT(*)::numeric
      ELSE 0 
    END as avg_revenue_per_doc
  FROM documents_to_be_verified dtv
  JOIN profiles p ON dtv.user_id = p.id
  WHERE p.role = 'user'
    AND (start_date IS NULL OR dtv.created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR dtv.created_at <= end_date::timestamptz)
  
  UNION ALL
  
  SELECT 
    'Authenticators'::text as user_type,
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_documents,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_documents,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing_documents,
    COALESCE(SUM(total_cost), 0) as total_revenue,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_cost), 0) / COUNT(*)::numeric
      ELSE 0 
    END as avg_revenue_per_doc
  FROM documents_to_be_verified dtv
  JOIN profiles p ON dtv.user_id = p.id
  WHERE p.role = 'authenticator'
    AND (start_date IS NULL OR dtv.created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR dtv.created_at <= end_date::timestamptz);
END;
$$;

-- Verificar se tudo está funcionando
SELECT 'Functions updated successfully. Testing access...' as status;
