-- Migration: Add is_internal_use field to documents table
-- This migration adds the is_internal_use field to differentiate between
-- documents uploaded by authenticators for clients vs personal use
-- Documents with is_internal_use = true should NOT be counted in financial/admin statistics

-- Add is_internal_use column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS is_internal_use BOOLEAN DEFAULT FALSE;

-- Update existing records to have default value (false)
UPDATE documents 
SET is_internal_use = FALSE
WHERE is_internal_use IS NULL;

-- Create index for better performance on is_internal_use field
CREATE INDEX IF NOT EXISTS idx_documents_is_internal_use ON documents(is_internal_use);

-- Add comment to document the new field
COMMENT ON COLUMN documents.is_internal_use IS 'Indicates if document is for authenticator personal use (true) or for a client (false). Personal use documents should not be counted in financial/admin statistics.';


















