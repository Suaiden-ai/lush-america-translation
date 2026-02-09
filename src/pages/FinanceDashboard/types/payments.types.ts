import { DateRange } from '../../../components/DateRangeFilter';

// Extended Document interface for the modal
export interface Document {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'deleted' | 'draft';
  file_path?: string;
  user_id?: string;
  created_at?: string;
  // Campos adicionais para o modal
  total_cost?: number;
  pages?: number;
  source_language?: string;
  target_language?: string;
  translation_type?: string;
  bank_statement?: boolean;
  authenticated?: boolean;
  verification_code?: string;
  // Informações do usuário
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  // Tipo de documento
  document_type?: 'authenticator' | 'payment';
  // URL do arquivo traduzido
  translated_file_url?: string;
}

// Define the structure of the data directly from Supabase join
export interface PaymentWithRelations {
  id: string;
  document_id: string;
  user_id: string;
  stripe_session_id: string | null;
  amount: number;
  fee_amount?: number | null;
  gross_amount?: number | null;
  currency: string;
  status: string; // payment status
  payment_method: string | null;
  payment_date: string | null;
  created_at: string;
  profiles: { email: string | null; name: string | null; role: string | null } | null;
  documents: {
    filename: string | null;
    status: Document['status'] | null;
    client_name: string | null;
    idioma_raiz: string | null;
    tipo_trad: string | null;
    verification_code: string | null;
  } | null; // document info from documents table
}

// Define the mapped Payment interface used in the component's state
export interface MappedPayment extends PaymentWithRelations {
  user_email: string | null;
  user_name: string | null;
  user_role: string | null; // Role do usuário (user, authenticator, admin, finance)
  client_name: string | null;
  document_filename: string | null;
  document_status: Document['status'] | null; // Adding document status here
  idioma_raiz: string | null;
  tipo_trad: string | null;
  // Authentication info from documents_to_be_verified
  authenticated_by_name: string | null;
  authenticated_by_email: string | null;
  authentication_date: string | null;
  source_language: string | null; // From documents_to_be_verified
  target_language: string | null; // From documents_to_be_verified
  pages: number | null;
  total_cost: number | null;
  fee_amount: number | null;
  gross_amount: number | null;
}

export interface PaymentsTableProps {
  initialDateRange?: DateRange;
}
