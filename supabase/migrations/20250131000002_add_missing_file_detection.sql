-- Função para identificar documentos com pagamento confirmado mas sem arquivo no Storage
-- Esta função é usada para detectar casos onde o cliente pagou mas o upload falhou

CREATE OR REPLACE FUNCTION get_documents_with_missing_files(user_id_param UUID DEFAULT NULL)
RETURNS TABLE (
  document_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  payment_id UUID,
  payment_status TEXT,
  payment_amount DECIMAL,
  payment_date TIMESTAMPTZ,
  filename TEXT,
  original_filename TEXT,
  status TEXT,
  total_cost DECIMAL,
  verification_code TEXT,
  created_at TIMESTAMPTZ,
  upload_failed_at TIMESTAMPTZ,
  upload_retry_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS document_id,
    d.user_id,
    p.name AS user_name,
    p.email AS user_email,
    pay.id AS payment_id,
    pay.status::TEXT AS payment_status,
    pay.amount AS payment_amount,
    pay.payment_date,
    d.filename,
    d.original_filename,
    d.status::TEXT,
    d.total_cost,
    d.verification_code,
    d.created_at,
    d.upload_failed_at,
    d.upload_retry_count
  FROM documents d
  INNER JOIN payments pay ON pay.document_id = d.id
  INNER JOIN profiles p ON p.id = d.user_id
  WHERE 
    pay.status = 'completed'
    AND (d.file_url IS NULL OR d.file_url = '')
    AND d.status IN ('pending', 'draft')
    AND (user_id_param IS NULL OR d.user_id = user_id_param)
  ORDER BY d.created_at DESC;
END;
$$;

-- Conceder permissões para usuários autenticados
GRANT EXECUTE ON FUNCTION get_documents_with_missing_files(UUID) TO authenticated;

-- Comentário para documentação
COMMENT ON FUNCTION get_documents_with_missing_files(UUID) IS 
'Retorna documentos que têm pagamento confirmado mas não têm arquivo no Storage. Útil para identificar casos que precisam de reenvio.';

