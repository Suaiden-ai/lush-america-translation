export interface Document {
  id: string;
  filename: string;
  user_id: string;
  pages?: number | null;
  status?: string;
  translated_file_url?: string | null;
  file_url?: string | null;
  created_at?: string | null;
  translation_status?: string;
  total_cost?: number | null;
  source_language?: string;
  target_language?: string;
  is_bank_statement?: boolean;
  verification_code?: string;
  // ID da tabela documents_to_be_verified se existir
  verification_id?: string | null;
  // Campos de auditoria
  authenticated_by?: string | null;
  authenticated_by_name?: string | null;
  authenticated_by_email?: string | null;
  authentication_date?: string | null;
  // Dados do usuário
  user_name?: string | null;
  user_email?: string | null;
  client_name?: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

export interface UploadState {
  file: File | null;
  uploading: boolean;
  success: boolean;
  error: string | null;
}

export interface UploadStates {
  [docId: string]: UploadState;
}

export interface RejectedRows {
  [docId: string]: boolean;
}

export interface Stats {
  pending: number;
  approved: number;
}

export type PreviewType = 'pdf' | 'image' | 'unknown';

export interface PreviewState {
  previewOpen: boolean;
  previewUrl: string | null;
  previewType: PreviewType;
  previewLoading: boolean;
  previewError: string | null;
  previewDocument: Document | null;
  previewBlobUrl: string | null;
}
