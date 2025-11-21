export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          client_id: string
          commission_amount: number
          commission_level: number
          commission_rate: number
          created_at: string | null
          document_id: string | null
          id: string
          pages_count: number
          payment_id: string
          reversal_reason: string | null
          reversed_at: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          client_id: string
          commission_amount: number
          commission_level: number
          commission_rate: number
          created_at?: string | null
          document_id?: string | null
          id?: string
          pages_count: number
          payment_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          client_id?: string
          commission_amount?: number
          commission_level?: number
          commission_rate?: number
          created_at?: string | null
          document_id?: string | null
          id?: string
          pages_count?: number
          payment_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_withdrawal_requests: {
        Row: {
          admin_notes: string | null
          affiliate_id: string
          amount: number
          id: string
          payment_details: Json
          payment_method: string
          processed_at: string | null
          processed_by: string | null
          requested_at: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          affiliate_id: string
          amount: number
          id?: string
          payment_details: Json
          payment_method: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          affiliate_id?: string
          amount?: number
          id?: string
          payment_details?: Json
          payment_method?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawal_requests_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          available_balance: number
          created_at: string | null
          current_level: number
          id: string
          last_withdrawal_request_date: string | null
          referral_code: string
          total_commission_earned: number
          total_pages_referred: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string | null
          current_level?: number
          id?: string
          last_withdrawal_request_date?: string | null
          referral_code: string
          total_commission_earned?: number
          total_pages_referred?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string | null
          current_level?: number
          id?: string
          last_withdrawal_request_date?: string | null
          referral_code?: string
          total_commission_earned?: number
          total_pages_referred?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_name: string | null
          created_at: string | null
          file_id: string | null
          file_url: string | null
          filename: string
          folder_id: string | null
          id: string
          idioma_destino: string | null
          idioma_raiz: string | null
          is_authenticated: boolean | null
          is_bank_statement: boolean | null
          original_filename: string | null
          pages: number | null
          payment_method: string | null
          receipt_url: string | null
          source_currency: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          target_currency: string | null
          tipo_trad: string | null
          total_cost: number | null
          updated_at: string | null
          upload_date: string | null
          uploaded_by: string | null
          user_id: string
          valor: number | null
          verification_code: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          file_id?: string | null
          file_url?: string | null
          filename: string
          folder_id?: string | null
          id?: string
          idioma_destino?: string | null
          idioma_raiz?: string | null
          is_authenticated?: boolean | null
          is_bank_statement?: boolean | null
          original_filename?: string | null
          pages?: number | null
          payment_method?: string | null
          receipt_url?: string | null
          source_currency?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          target_currency?: string | null
          tipo_trad?: string | null
          total_cost?: number | null
          updated_at?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
          user_id: string
          valor?: number | null
          verification_code?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          file_id?: string | null
          file_url?: string | null
          filename?: string
          folder_id?: string | null
          id?: string
          idioma_destino?: string | null
          idioma_raiz?: string | null
          is_authenticated?: boolean | null
          is_bank_statement?: boolean | null
          original_filename?: string | null
          pages?: number | null
          payment_method?: string | null
          receipt_url?: string | null
          source_currency?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          target_currency?: string | null
          tipo_trad?: string | null
          total_cost?: number | null
          updated_at?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
          user_id?: string
          valor?: number | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "auth_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_to_be_verified: {
        Row: {
          authenticated_by: string | null
          authenticated_by_email: string | null
          authenticated_by_name: string | null
          authentication_date: string | null
          client_name: string | null
          created_at: string | null
          file_id: string | null
          file_url: string | null
          filename: string
          folder_id: string | null
          id: string
          is_authenticated: boolean | null
          is_bank_statement: boolean | null
          original_document_id: string | null
          original_filename: string | null
          pages: number | null
          receipt_url: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_comment: string | null
          rejection_reason: string | null
          source_currency: string | null
          source_language: string | null
          status: string
          target_currency: string | null
          target_language: string | null
          total_cost: number
          translated_file_url: string | null
          translation_status: string | null
          updated_at: string | null
          upload_date: string | null
          user_id: string
          verification_code: string | null
        }
        Insert: {
          authenticated_by?: string | null
          authenticated_by_email?: string | null
          authenticated_by_name?: string | null
          authentication_date?: string | null
          client_name?: string | null
          created_at?: string | null
          file_id?: string | null
          file_url?: string | null
          filename: string
          folder_id?: string | null
          id?: string
          is_authenticated?: boolean | null
          is_bank_statement?: boolean | null
          original_document_id?: string | null
          original_filename?: string | null
          pages?: number | null
          receipt_url?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_comment?: string | null
          rejection_reason?: string | null
          source_currency?: string | null
          source_language?: string | null
          status?: string
          target_currency?: string | null
          target_language?: string | null
          total_cost?: number
          translated_file_url?: string | null
          translation_status?: string | null
          updated_at?: string | null
          upload_date?: string | null
          user_id: string
          verification_code?: string | null
        }
        Update: {
          authenticated_by?: string | null
          authenticated_by_email?: string | null
          authenticated_by_name?: string | null
          authentication_date?: string | null
          client_name?: string | null
          created_at?: string | null
          file_id?: string | null
          file_url?: string | null
          filename?: string
          folder_id?: string | null
          id?: string
          is_authenticated?: boolean | null
          is_bank_statement?: boolean | null
          original_document_id?: string | null
          original_filename?: string | null
          pages?: number | null
          receipt_url?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_comment?: string | null
          rejection_reason?: string | null
          source_currency?: string | null
          source_language?: string | null
          status?: string
          target_currency?: string | null
          target_language?: string | null
          total_cost?: number
          translated_file_url?: string | null
          translation_status?: string | null
          updated_at?: string | null
          upload_date?: string | null
          user_id?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_to_be_verified_authenticated_by_fkey"
            columns: ["authenticated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_to_be_verified_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_to_be_verified_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_to_be_verified_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean
          message: string
          related_document_id: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          related_document_id?: string | null
          title: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          related_document_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          base_amount: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          currency: string | null
          document_id: string | null
          fee_amount: number | null
          gross_amount: number | null
          id: string
          payment_date: string | null
          payment_method: string | null
          receipt_url: string | null
          refund_amount: number | null
          refund_id: string | null
          status: string | null
          stripe_session_id: string | null
          updated_at: string | null
          user_id: string | null
          zelle_confirmation_code: string | null
          zelle_verified_at: string | null
          zelle_verified_by: string | null
        }
        Insert: {
          amount: number
          base_amount?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          document_id?: string | null
          fee_amount?: number | null
          gross_amount?: number | null
          id?: string
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          status?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zelle_confirmation_code?: string | null
          zelle_verified_at?: string | null
          zelle_verified_by?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          document_id?: string | null
          fee_amount?: number | null
          gross_amount?: number | null
          id?: string
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          status?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zelle_confirmation_code?: string | null
          zelle_verified_at?: string | null
          zelle_verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_zelle_verified_by_fkey"
            columns: ["zelle_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          referred_by_code: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name: string
          phone?: string | null
          referred_by_code?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          referred_by_code?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "auth_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          description: string | null
          file_url: string | null
          generated_by: string | null
          id: string
          parameters: Json | null
          report_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_url?: string | null
          generated_by?: string | null
          id?: string
          parameters?: Json | null
          report_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_url?: string | null
          generated_by?: string | null
          id?: string
          parameters?: Json | null
          report_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_sessions: {
        Row: {
          amount: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          currency: string | null
          document_id: string
          id: string
          metadata: Json | null
          payment_status: string | null
          refund_id: string | null
          session_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          document_id: string
          id?: string
          metadata?: Json | null
          payment_status?: string | null
          refund_id?: string | null
          session_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          document_id?: string
          id?: string
          metadata?: Json | null
          payment_status?: string | null
          refund_id?: string | null
          session_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_sessions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      translated_documents: {
        Row: {
          authenticated_by: string | null
          authenticated_by_email: string | null
          authenticated_by_name: string | null
          authentication_date: string | null
          created_at: string | null
          filename: string
          folder_id: string | null
          id: string
          is_authenticated: boolean | null
          is_deleted: boolean | null
          original_document_id: string
          pages: number | null
          receipt_url: string | null
          source_language: string
          status: string
          target_language: string
          total_cost: number
          translated_file_url: string
          updated_at: string | null
          upload_date: string | null
          user_id: string
          verification_code: string
        }
        Insert: {
          authenticated_by?: string | null
          authenticated_by_email?: string | null
          authenticated_by_name?: string | null
          authentication_date?: string | null
          created_at?: string | null
          filename: string
          folder_id?: string | null
          id?: string
          is_authenticated?: boolean | null
          is_deleted?: boolean | null
          original_document_id: string
          pages?: number | null
          receipt_url?: string | null
          source_language: string
          status?: string
          target_language: string
          total_cost?: number
          translated_file_url: string
          updated_at?: string | null
          upload_date?: string | null
          user_id: string
          verification_code: string
        }
        Update: {
          authenticated_by?: string | null
          authenticated_by_email?: string | null
          authenticated_by_name?: string | null
          authentication_date?: string | null
          created_at?: string | null
          filename?: string
          folder_id?: string | null
          id?: string
          is_authenticated?: boolean | null
          is_deleted?: boolean | null
          original_document_id?: string
          pages?: number | null
          receipt_url?: string | null
          source_language?: string
          status?: string
          target_language?: string
          total_cost?: number
          translated_file_url?: string
          updated_at?: string | null
          upload_date?: string | null
          user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "translated_documents_authenticated_by_fkey"
            columns: ["authenticated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translated_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translated_documents_original_document_id_fkey"
            columns: ["original_document_id"]
            isOneToOne: false
            referencedRelation: "documents_to_be_verified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translated_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auth_users_view: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          last_sign_in_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          last_sign_in_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          last_sign_in_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_affiliate_commission: {
        Args: {
          p_client_id: string
          p_document_id: string
          p_pages_count: number
          p_payment_id: string
        }
        Returns: undefined
      }
      check_current_costs: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_cost: number
          document_count: number
          total_revenue: number
          user_role: string
        }[]
      }
      check_file_accessibility: {
        Args: { file_path: string }
        Returns: boolean
      }
      check_total_cost_by_role: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_cost: number
          document_count: number
          max_cost: number
          min_cost: number
          total_revenue: number
          user_role: string
        }[]
      }
      check_total_cost_by_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_cost: number
          document_count: number
          max_cost: number
          min_cost: number
          status: string
          total_revenue: number
        }[]
      }
      cleanup_duplicate_documents: {
        Args: Record<PropertyKey, never>
        Returns: {
          duplicates_removed: number
          message: string
          table_name: string
        }[]
      }
      create_profile_for_user: {
        Args: { user_email: string }
        Returns: {
          action: string
          email: string
          success: boolean
          user_id: string
        }[]
      }
      create_withdrawal_request: {
        Args: {
          p_affiliate_user_id: string
          p_amount: number
          p_payment_details: Json
          p_payment_method: string
        }
        Returns: string
      }
      debug_auth_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          auth_role: string
          current_user_id: string
          current_user_role: string
          is_authenticated: boolean
        }[]
      }
      debug_document_revenue: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          document_id: string
          filename: string
          status: string
          total_cost: number
          user_id: string
          user_role: string
        }[]
      }
      generate_comprehensive_report: {
        Args: {
          p_end_date?: string
          p_report_type?: string
          p_start_date?: string
        }
        Returns: Json
      }
      generate_payment_report: {
        Args: { end_date?: string; report_type?: string; start_date?: string }
        Returns: {
          amount: number
          document_id: string
          payment_date: string
          status: string
          stripe_session_id: string
          user_email: string
        }[]
      }
      generate_permanent_public_url: {
        Args: { file_path: string }
        Returns: string
      }
      generate_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_verification_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_affiliate_clients: {
        Args: { p_affiliate_user_id: string }
        Returns: {
          client_email: string
          client_id: string
          client_name: string
          registered_at: string
          total_commission: number
          total_pages: number
        }[]
      }
      get_affiliate_commissions_history: {
        Args: { p_affiliate_user_id: string }
        Returns: {
          client_name: string
          commission_amount: number
          commission_level: number
          commission_rate: number
          created_at: string
          id: string
          pages_count: number
          reversal_reason: string
          reversed_at: string
          status: string
        }[]
      }
      get_affiliate_stats: {
        Args: { p_affiliate_user_id: string }
        Returns: {
          current_level: number
          pages_to_next_level: number
          referral_code: string
          total_balance: number
          total_clients: number
          total_earned: number
          total_pages: number
        }[]
      }
      get_all_affiliates_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          affiliate_id: string
          available_balance: number
          created_at: string
          current_level: number
          referral_code: string
          total_clients: number
          total_earned: number
          total_pages: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_authenticator_documents: {
        Args: Record<PropertyKey, never>
        Returns: {
          authenticator_email: string
          authenticator_id: string
          authenticator_name: string
          authenticator_role: string
          client_email: string
          client_id: string
          client_name: string
          created_at: string
          filename: string
          id: string
          payment_method: string
          receipt_url: string
          source_language: string
          target_language: string
          total_cost: number
          translated_file_url: string
        }[]
      }
      get_combined_document_stats: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          authenticator_uploads_completed: number
          authenticator_uploads_pending: number
          authenticator_uploads_revenue: number
          authenticator_uploads_total: number
          total_documents: number
          total_revenue: number
          user_uploads_completed: number
          user_uploads_pending: number
          user_uploads_revenue: number
          user_uploads_total: number
        }[]
      }
      get_combined_payment_stats: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_payment_amount: number
          completed_payments: number
          failed_payments: number
          pending_payments: number
          total_amount: number
          total_payments: number
        }[]
      }
      get_document_status_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          count: number
          status: string
          total_revenue: number
        }[]
      }
      get_enhanced_translation_stats: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          authenticator_uploads_completed: number
          authenticator_uploads_pending: number
          authenticator_uploads_revenue: number
          authenticator_uploads_total: number
          total_completed: number
          total_documents: number
          total_pending: number
          total_processing: number
          total_rejected: number
          total_revenue: number
          user_uploads_completed: number
          user_uploads_pending: number
          user_uploads_revenue: number
          user_uploads_total: number
        }[]
      }
      get_payment_stats: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          completed_payments: number
          failed_payments: number
          pending_payments: number
          total_amount: number
          total_payments: number
        }[]
      }
      get_pending_withdrawal_requests: {
        Args: Record<PropertyKey, never>
        Returns: {
          admin_notes: string
          affiliate_email: string
          affiliate_id: string
          affiliate_name: string
          amount: number
          payment_details: Json
          payment_method: string
          request_id: string
          requested_at: string
          status: string
        }[]
      }
      get_pending_zelle_payments: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          created_at: string
          document_filename: string
          payment_id: string
          receipt_url: string
          user_email: string
          user_name: string
        }[]
      }
      get_simple_document_count: {
        Args: Record<PropertyKey, never>
        Returns: {
          documents_count: number
          documents_to_be_verified_count: number
          total_combined: number
        }[]
      }
      get_simple_payment_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          completed_payments: number
          pending_payments: number
          total_amount: number
          total_payments: number
        }[]
      }
      get_simple_translation_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          completed_translations: number
          pending_translations: number
          processing_translations: number
          total_documents: number
        }[]
      }
      get_translation_stats: {
        Args:
          | { end_date?: string; start_date?: string }
          | { end_date?: string; start_date?: string }
        Returns: {
          completed_translations: number
          pending_translations: number
          total_documents: number
          total_revenue: number
        }[]
      }
      get_user_type_breakdown: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_revenue_per_doc: number
          completed_documents: number
          pending_documents: number
          processing_documents: number
          rejected_documents: number
          total_documents: number
          total_revenue: number
          user_type: string
        }[]
      }
      has_any_role: {
        Args:
          | {
              required_roles: Database["public"]["Enums"]["user_role"][]
              user_id: string
            }
          | { required_roles: string[]; user_id: string }
        Returns: boolean
      }
      has_finance_access: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_role: {
        Args:
          | {
              required_role: Database["public"]["Enums"]["user_role"]
              user_id: string
            }
          | { required_role: string; user_id: string }
        Returns: boolean
      }
      is_admin: {
        Args: { user_id?: string }
        Returns: boolean
      }
      is_lush_admin: {
        Args: { user_id?: string }
        Returns: boolean
      }
      reverse_affiliate_commission: {
        Args: { p_payment_id: string; p_reversal_reason?: string }
        Returns: undefined
      }
      safe_insert_document: {
        Args: {
          p_client_name?: string
          p_file_id?: string
          p_filename: string
          p_idioma_raiz?: string
          p_is_bank_statement?: boolean
          p_pages?: number
          p_source_language?: string
          p_status?: string
          p_target_language?: string
          p_tipo_trad?: string
          p_total_cost?: number
          p_translation_status?: string
          p_user_id: string
          p_valor?: number
        }
        Returns: {
          document_id: string
          message: string
          verification_code: string
        }[]
      }
      set_test_costs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_existing_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          action: string
          success: boolean
          user_email: string
          user_id: string
        }[]
      }
      update_affiliate_level: {
        Args: { p_affiliate_id: string }
        Returns: undefined
      }
      verify_zelle_payment: {
        Args: { payment_id: string }
        Returns: boolean
      }
    }
    Enums: {
      document_status: "pending" | "processing" | "completed" | "draft"
      user_role:
        | "user"
        | "admin"
        | "authenticator"
        | "lush-admin"
        | "finance"
        | "affiliate"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      document_status: ["pending", "processing", "completed", "draft"],
      user_role: [
        "user",
        "admin",
        "authenticator",
        "lush-admin",
        "finance",
        "affiliate",
      ],
    },
  },
} as const