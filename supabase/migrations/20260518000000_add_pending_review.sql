-- Migration: Add 'pending_review' to public.documents status constraint
-- Purpose: Zelle receipts that fail automatic validation need a distinct status
--          to differentiate from normal 'pending' documents.

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents ADD CONSTRAINT documents_status_check 
  CHECK (status = ANY (ARRAY[
    'pending'::text, 
    'stripe_pending'::text, 
    'zelle_pending'::text, 
    'processing'::text, 
    'completed'::text, 
    'cancelled'::text, 
    'pending_payment_verification'::text, 
    'pending_manual_review'::text,
    'pending_review'::text
  ]));

