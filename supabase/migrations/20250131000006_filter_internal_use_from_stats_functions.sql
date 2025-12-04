-- Migration: Filter is_internal_use documents from statistics functions
-- This migration updates SQL functions to exclude documents with is_internal_use = true
-- from statistics calculations

-- Update get_translation_stats_filtered to exclude internal use documents
CREATE OR REPLACE FUNCTION get_translation_stats_filtered(
    start_date TIMESTAMP DEFAULT NULL,
    end_date TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    total_documents BIGINT,
    completed_documents BIGINT,
    pending_documents BIGINT,
    total_revenue NUMERIC,
    avg_revenue_per_doc NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_documents,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_documents,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_documents,
        COALESCE(SUM(total_cost), 0) as total_revenue,
        COALESCE(AVG(total_cost), 0) as avg_revenue_per_doc
    FROM documents
    WHERE (start_date IS NULL OR created_at >= start_date)
      AND (end_date IS NULL OR created_at <= end_date)
      AND (is_internal_use IS NULL OR is_internal_use = false);
END;
$$ LANGUAGE plpgsql;

-- Update get_enhanced_translation_stats_filtered to exclude internal use documents
CREATE OR REPLACE FUNCTION get_enhanced_translation_stats_filtered(
    start_date TIMESTAMP DEFAULT NULL,
    end_date TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    total_documents BIGINT,
    total_revenue NUMERIC,
    user_uploads_total BIGINT,
    user_uploads_revenue NUMERIC,
    authenticator_uploads_total BIGINT,
    authenticator_uploads_revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_documents,
        COALESCE(SUM(total_cost), 0) as total_revenue,
        COUNT(*) FILTER (WHERE (uploaded_by IS NULL OR uploaded_by::text = 'user') AND (is_internal_use IS NULL OR is_internal_use = false)) as user_uploads_total,
        COALESCE(SUM(total_cost) FILTER (WHERE (uploaded_by IS NULL OR uploaded_by::text = 'user') AND (is_internal_use IS NULL OR is_internal_use = false)), 0) as user_uploads_revenue,
        COUNT(*) FILTER (WHERE uploaded_by::text = 'authenticator' AND (is_internal_use IS NULL OR is_internal_use = false)) as authenticator_uploads_total,
        COALESCE(SUM(total_cost) FILTER (WHERE uploaded_by::text = 'authenticator' AND (is_internal_use IS NULL OR is_internal_use = false)), 0) as authenticator_uploads_revenue
    FROM documents
    WHERE (start_date IS NULL OR created_at >= start_date)
      AND (end_date IS NULL OR created_at <= end_date)
      AND (is_internal_use IS NULL OR is_internal_use = false);
END;
$$ LANGUAGE plpgsql;

-- Update get_user_type_breakdown_filtered to exclude internal use documents
CREATE OR REPLACE FUNCTION get_user_type_breakdown_filtered(
    start_date TIMESTAMP DEFAULT NULL,
    end_date TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    user_type TEXT,
    total_documents BIGINT,
    completed_documents BIGINT,
    pending_documents BIGINT,
    rejected_documents BIGINT,
    total_revenue NUMERIC,
    avg_revenue_per_doc NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN d.uploaded_by::text = 'authenticator' THEN 'Authenticators'
            ELSE 'Regular Users'
        END as user_type,
        COUNT(*) as total_documents,
        COUNT(*) FILTER (WHERE d.status = 'completed') as completed_documents,
        COUNT(*) FILTER (WHERE d.status = 'pending') as pending_documents,
        COUNT(*) FILTER (WHERE d.status = 'rejected') as rejected_documents,
        COALESCE(SUM(d.total_cost), 0) as total_revenue,
        COALESCE(AVG(d.total_cost), 0) as avg_revenue_per_doc
    FROM documents d
    WHERE (start_date IS NULL OR d.created_at >= start_date)
      AND (end_date IS NULL OR d.created_at <= end_date)
      AND (d.is_internal_use IS NULL OR d.is_internal_use = false)
    GROUP BY 
        CASE 
            WHEN d.uploaded_by::text = 'authenticator' THEN 'Authenticators'
            ELSE 'Regular Users'
        END
    ORDER BY user_type;
END;
$$ LANGUAGE plpgsql;

-- Update get_translation_stats to exclude internal use documents
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
  FROM documents
  WHERE 
    (start_date IS NULL OR created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR created_at <= end_date::timestamptz)
    AND (is_internal_use IS NULL OR is_internal_use = false);
END;
$$;

-- Add comments
COMMENT ON FUNCTION get_translation_stats_filtered(TIMESTAMP, TIMESTAMP) IS 
'Get translation statistics filtered by date range. Excludes documents with is_internal_use = true.';

COMMENT ON FUNCTION get_enhanced_translation_stats_filtered(TIMESTAMP, TIMESTAMP) IS 
'Get enhanced translation statistics with user type separation filtered by date range. Excludes documents with is_internal_use = true.';

COMMENT ON FUNCTION get_user_type_breakdown_filtered(TIMESTAMP, TIMESTAMP) IS 
'Get detailed breakdown of documents by user type filtered by date range. Excludes documents with is_internal_use = true.';

COMMENT ON FUNCTION get_enhanced_translation_stats(text, text) IS 
'Get enhanced translation statistics with user type separation. Excludes documents with is_internal_use = true.';

COMMENT ON FUNCTION get_user_type_breakdown(text, text) IS 
'Get detailed breakdown of documents by user type. Excludes documents with is_internal_use = true.';

-- Update get_enhanced_translation_stats from fix_finance_dashboard_functions.sql
-- This version uses documents table directly (not documents_to_be_verified)
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
    -- Statistics for regular user uploads (excluding internal use)
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE d.status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE d.status = 'pending')::bigint as pending,
      COALESCE(SUM(d.total_cost), 0) as revenue
    FROM documents d
    JOIN profiles p ON d.user_id = p.id
    WHERE p.role = 'user'
      AND (d.is_internal_use IS NULL OR d.is_internal_use = false)
      AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
  ),
  authenticator_stats AS (
    -- Statistics for authenticator uploads (excluding internal use)
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE d.status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE d.status = 'pending')::bigint as pending,
      COALESCE(SUM(d.total_cost), 0) as revenue
    FROM documents d
    JOIN profiles p ON d.user_id = p.id
    WHERE p.role = 'authenticator'
      AND (d.is_internal_use IS NULL OR d.is_internal_use = false)
      AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
  ),
  overall_stats AS (
    -- Overall statistics (excluding internal use)
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE d.status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE d.status = 'pending')::bigint as pending,
      COUNT(*) FILTER (WHERE d.status = 'processing')::bigint as processing,
      COUNT(*) FILTER (WHERE d.status = 'rejected')::bigint as rejected,
      COALESCE(SUM(d.total_cost), 0) as revenue
    FROM documents d
    WHERE (d.is_internal_use IS NULL OR d.is_internal_use = false)
      AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
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

-- Update get_user_type_breakdown from fix_finance_dashboard_functions.sql
-- This version uses documents table directly
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
    COUNT(*) FILTER (WHERE d.status = 'completed')::bigint as completed_documents,
    COUNT(*) FILTER (WHERE d.status = 'pending')::bigint as pending_documents,
    COUNT(*) FILTER (WHERE d.status = 'processing')::bigint as processing_documents,
    COUNT(*) FILTER (WHERE d.status = 'rejected')::bigint as rejected_documents,
    COALESCE(SUM(d.total_cost), 0) as total_revenue,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(d.total_cost), 0) / COUNT(*)::numeric
      ELSE 0 
    END as avg_revenue_per_doc
  FROM documents d
  JOIN profiles p ON d.user_id = p.id
  WHERE p.role = 'user'
    AND (d.is_internal_use IS NULL OR d.is_internal_use = false)
    AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
  
  UNION ALL
  
  SELECT 
    'Authenticators'::text as user_type,
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE d.status = 'completed')::bigint as completed_documents,
    COUNT(*) FILTER (WHERE d.status = 'pending')::bigint as pending_documents,
    COUNT(*) FILTER (WHERE d.status = 'processing')::bigint as processing_documents,
    COUNT(*) FILTER (WHERE d.status = 'rejected')::bigint as rejected_documents,
    COALESCE(SUM(d.total_cost), 0) as total_revenue,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(d.total_cost), 0) / COUNT(*)::numeric
      ELSE 0 
    END as avg_revenue_per_doc
  FROM documents d
  JOIN profiles p ON d.user_id = p.id
  WHERE p.role = 'authenticator'
    AND (d.is_internal_use IS NULL OR d.is_internal_use = false)
    AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR d.created_at <= end_date::timestamptz);
END;
$$;

