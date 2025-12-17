-- Fix para corrigir as funções RPC do dashboard financeiro
-- Problema: As funções estavam usando documents_to_be_verified em vez de documents

-- Drop existing functions first to avoid return type conflicts
-- Drop all variations of the functions
DROP FUNCTION IF EXISTS get_translation_stats();
DROP FUNCTION IF EXISTS get_translation_stats(text);  
DROP FUNCTION IF EXISTS get_translation_stats(text, text);
DROP FUNCTION IF EXISTS get_enhanced_translation_stats();
DROP FUNCTION IF EXISTS get_enhanced_translation_stats(text);
DROP FUNCTION IF EXISTS get_enhanced_translation_stats(text, text);
DROP FUNCTION IF EXISTS get_user_type_breakdown();
DROP FUNCTION IF EXISTS get_user_type_breakdown(text);
DROP FUNCTION IF EXISTS get_user_type_breakdown(text, text);

-- Function to get translation statistics - CORRIGIDA para usar tabela documents
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
  -- Check if user is lush-admin
  IF NOT is_lush_admin() THEN
    RAISE EXCEPTION 'Access denied. Only lush-admin users can access this function.';
  END IF;
  
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_translations,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_translations,
    COALESCE(SUM(total_cost), 0) as total_revenue
  FROM documents  -- CORREÇÃO: mudou de documents_to_be_verified para documents
  WHERE 
    (start_date IS NULL OR created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR created_at <= end_date::timestamptz);
END;
$$;

-- Enhanced function to get translation statistics with user type separation - CORRIGIDA
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
  total_processing bigint,
  total_rejected bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is lush-admin or finance
  IF NOT (is_lush_admin() OR is_finance()) THEN
    RAISE EXCEPTION 'Access denied. Only lush-admin or finance users can access this function.';
  END IF;
  
  RETURN QUERY
  WITH user_stats AS (
    -- Statistics for regular user uploads
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending,
      COALESCE(SUM(total_cost), 0) as revenue
    FROM documents d  -- CORREÇÃO: mudou de documents_to_be_verified para documents
    JOIN profiles p ON d.user_id = p.id
    WHERE p.role = 'user'
      AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
  ),
  authenticator_stats AS (
    -- Statistics for authenticator uploads
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending,
      COALESCE(SUM(total_cost), 0) as revenue
    FROM documents d  -- CORREÇÃO: mudou de documents_to_be_verified para documents
    JOIN profiles p ON d.user_id = p.id
    WHERE p.role = 'authenticator'
      AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
  ),
  overall_stats AS (
    -- Overall statistics
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending,
      COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing,
      COUNT(*) FILTER (WHERE status = 'rejected')::bigint as rejected,
      COALESCE(SUM(total_cost), 0) as revenue
    FROM documents d  -- CORREÇÃO: mudou de documents_to_be_verified para documents
    WHERE (start_date IS NULL OR d.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
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
    auths.total as authenticator_uploads_total,
    auths.completed as authenticator_uploads_completed,
    auths.pending as authenticator_uploads_pending,
    auths.revenue as authenticator_uploads_revenue,
    
    -- Processing status
    os.completed as total_completed,
    os.pending as total_pending,
    os.processing as total_processing,
    os.rejected as total_rejected
  FROM overall_stats os
  CROSS JOIN user_stats us
  CROSS JOIN authenticator_stats auths;
END;
$$;

-- Function to get user type breakdown for specific date ranges - CORRIGIDA
CREATE OR REPLACE FUNCTION get_user_type_breakdown(start_date text DEFAULT NULL, end_date text DEFAULT NULL)
RETURNS TABLE(
  user_type text,
  total_documents bigint,
  completed_documents bigint,
  pending_documents bigint,
  processing_documents bigint,
  rejected_documents bigint,
  total_revenue numeric,
  avg_revenue_per_doc numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is lush-admin or finance
  IF NOT (is_lush_admin() OR is_finance()) THEN
    RAISE EXCEPTION 'Access denied. Only lush-admin or finance users can access this function.';
  END IF;
  
  RETURN QUERY
  SELECT 
    'Regular Users'::text as user_type,
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_documents,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_documents,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing_documents,
    COUNT(*) FILTER (WHERE status = 'rejected')::bigint as rejected_documents,
    COALESCE(SUM(total_cost), 0) as total_revenue,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_cost), 0) / COUNT(*)::numeric
      ELSE 0 
    END as avg_revenue_per_doc
  FROM documents d  -- CORREÇÃO: mudou de documents_to_be_verified para documents
  JOIN profiles p ON d.user_id = p.id
  WHERE p.role = 'user'
    AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
  
  UNION ALL
  
  SELECT 
    'Authenticators'::text as user_type,
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_documents,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_documents,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing_documents,
    COUNT(*) FILTER (WHERE status = 'rejected')::bigint as rejected_documents,
    COALESCE(SUM(total_cost), 0) as total_revenue,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_cost), 0) / COUNT(*)::numeric
      ELSE 0 
    END as avg_revenue_per_doc
  FROM documents d  -- CORREÇÃO: mudou de documents_to_be_verified para documents
  JOIN profiles p ON d.user_id = p.id
  WHERE p.role = 'authenticator'
    AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR d.created_at <= end_date::timestamptz);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_translation_stats(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enhanced_translation_stats(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_type_breakdown(text, text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_translation_stats(text, text) IS 'Get translation statistics from documents table for Finance Dashboard';
COMMENT ON FUNCTION get_enhanced_translation_stats(text, text) IS 'Get enhanced translation statistics with user type separation from documents table for Finance Dashboard';
COMMENT ON FUNCTION get_user_type_breakdown(text, text) IS 'Get detailed breakdown of documents by user type from documents table (regular users vs authenticators)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'All functions updated successfully! Finance Dashboard now uses documents table instead of documents_to_be_verified.';
END $$;
