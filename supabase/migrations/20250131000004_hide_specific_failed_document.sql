-- Ocultar documento específico da lista de documentos com falha de upload
-- Documento: RI-DIGITAL-MAT48812.pdf do cliente jrbmw118@icloud.com (Luis Duarte)
-- Não apagar, apenas ocultar da lista

CREATE OR REPLACE FUNCTION get_documents_with_missing_files(user_id_param UUID DEFAULT NULL)
RETURNS TABLE (
  document_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  payment_id UUID,
  payment_status TEXT,
  payment_amount DECIMAL,
  payment_gross_amount DECIMAL,
  payment_fee_amount DECIMAL,
  payment_date TIMESTAMPTZ,
  filename TEXT,
  original_filename TEXT,
  status TEXT,
  total_cost DECIMAL,
  verification_code TEXT,
  created_at TIMESTAMPTZ,
  upload_failed_at TIMESTAMPTZ,
  upload_retry_count INTEGER,
  pages INTEGER
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
    pay.gross_amount AS payment_gross_amount,
    pay.fee_amount AS payment_fee_amount,
    pay.payment_date,
    d.filename,
    d.original_filename,
    d.status::TEXT,
    d.total_cost,
    d.verification_code,
    d.created_at,
    d.upload_failed_at,
    d.upload_retry_count,
    d.pages
  FROM documents d
  INNER JOIN payments pay ON pay.document_id = d.id
  INNER JOIN profiles p ON p.id = d.user_id
  WHERE 
    pay.status = 'completed'
    AND (d.file_url IS NULL OR d.file_url = '')
    AND d.status IN ('pending', 'draft', 'processing')
    AND (user_id_param IS NULL OR d.user_id = user_id_param)
    -- Ocultar documento específico: RI-DIGITAL-MAT48812.pdf do cliente jrbmw118@icloud.com
    AND NOT (
      (p.email = 'jrbmw118@icloud.com' AND (d.filename LIKE '%RI-DIGITAL-MAT48812%' OR d.original_filename LIKE '%RI-DIGITAL-MAT48812%'))
    )
  ORDER BY d.created_at DESC;
END;
$$;

-- Comentário atualizado
COMMENT ON FUNCTION get_documents_with_missing_files(UUID) IS 
'Retorna documentos que têm pagamento confirmado mas não têm arquivo no Storage. Inclui pages, payment_gross_amount e payment_fee_amount. Exclui documentos ocultos especificamente. Útil para identificar casos que precisam de reenvio.';
















