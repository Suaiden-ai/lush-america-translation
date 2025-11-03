import React, { useState } from 'react';
import { 
  User, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Code, 
  ExternalLink, 
  DollarSign, 
  FileText, 
  Globe,
  Shield,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Download
} from 'lucide-react';
import { ActionLog } from '../hooks/useActionLogs';

interface LogItemProps {
  log: ActionLog;
  onEntityClick?: (entityType: string, entityId: string) => void;
}

export const LogItem: React.FC<LogItemProps> = ({ log, onEntityClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null); // Guardar URL original para download
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Formatar para mostrar data e hora exata
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // Usar formato 24h
    };
    
    return date.toLocaleString('pt-BR', options);
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    // Stripe armazena valores em centavos, então dividimos por 100
    const formattedAmount = amount / 100;
    
    // Formatar baseado na moeda
    switch (currency.toLowerCase()) {
      case 'usd':
        return `$${formattedAmount.toFixed(2)}`;
      case 'brl':
        return `R$ ${formattedAmount.toFixed(2)}`;
      case 'eur':
        return `€${formattedAmount.toFixed(2)}`;
      default:
        return `${currency.toUpperCase()} ${formattedAmount.toFixed(2)}`;
    }
  };

  const formatActionDescription = (actionType: string, actionDescription: string, metadata: any) => {
    // Se a descrição já está formatada de forma amigável, usar ela
    if (actionDescription.includes('uploaded') || actionDescription.includes('completed') || 
        actionDescription.includes('approved') || actionDescription.includes('rejected')) {
      return actionDescription;
    }

    // Formatar baseado no tipo de ação e metadata
    switch (actionType) {
      case 'DOCUMENT_UPLOADED':
        const filename = metadata?.filename || metadata?.original_filename || 'document';
        return `📄 Document uploaded: ${filename}`;
      
      case 'DOCUMENT_UPLOAD_FAILED':
        return `❌ Document upload failed`;
      
      case 'DOCUMENT_READY_FOR_AUTHENTICATION':
        const docName = metadata?.filename || 'document';
        return `🔍 Document ready for review: ${docName}`;
      
      case 'DOCUMENT_MANUAL_UPLOAD_BY_AUTHENTICATOR':
        const correctedFile = metadata?.filename || 'corrected document';
        return `🛡️ Authenticator uploaded corrected document: ${correctedFile}`;
      
      case 'DOCUMENT_DELIVERED':
        const deliveredFile = metadata?.filename || 'document';
        return `✅ Document delivered: ${deliveredFile}`;
      
      case 'DOCUMENT_STATUS_CHANGED':
        const statusFile = metadata?.filename || 'document';
        const newStatus = metadata?.new_status || 'updated';
        return `📋 Document status changed to ${newStatus}: ${statusFile}`;
      
      case 'CHECKOUT_CREATED':
        const checkoutFile = metadata?.filename || 'document';
        return `💳 Payment session created for: ${checkoutFile}`;
      
      case 'CHECKOUT_STARTED':
        const startedFile = metadata?.filename || 'document';
        return `🚀 Payment process started for: ${startedFile}`;
      
      case 'CHECKOUT_ABANDONED':
        const abandonedFile = metadata?.filename || 'document';
        const timeSpent = metadata?.time_spent_seconds ? ` (after ${metadata.time_spent_seconds}s)` : '';
        return `⏰ Payment abandoned for: ${abandonedFile}${timeSpent}`;
      
      case 'PAYMENT_PROCESSING':
        const processingFile = metadata?.filename || 'document';
        return `⏳ Payment processing: ${processingFile}`;
      
      case 'payment_received':
        const paidFile = metadata?.document_filename || 'document';
        const amount = metadata?.amount_total_formatted || metadata?.amount_total;
        return `💰 Payment received: ${amount} for ${paidFile}`;
      
      case 'payment_failed':
        const failedFile = metadata?.document_filename || 'document';
        return `❌ Payment failed for: ${failedFile}`;
      
      case 'payment_cancelled':
        const cancelledFile = metadata?.document_filename || 'document';
        return `🚫 Payment cancelled for: ${cancelledFile}`;
      
      case 'document_approve':
        const approvedFile = metadata?.filename || 'document';
        return `✅ Document approved: ${approvedFile}`;
      
      case 'document_reject':
        const rejectedFile = metadata?.filename || 'document';
        const reason = metadata?.reason ? ` (${metadata.reason})` : '';
        return `❌ Document rejected: ${rejectedFile}${reason}`;
      
      case 'ZELLE_PAYMENT_VERIFIED':
        const verifiedFile = metadata?.filename || 'document';
        return `✅ Zelle payment verified for: ${verifiedFile}`;
      
      case 'zelle_selected':
        return `🏦 Zelle payment method selected`;
      
      case 'zelle_checkout_opened':
        return `🏦 Opened Zelle checkout`;
      
      case 'zelle_receipt_attached':
        const attachedFile = metadata?.filename || 'receipt';
        return `📎 Receipt attached: ${attachedFile}`;
      
      case 'zelle_receipt_uploaded':
        return `📤 Receipt uploaded successfully`;
      
      case 'zelle_receipt_upload_failed':
        return `❌ Receipt upload failed`;
      
      case 'zelle_validation_attempted':
        return `🔍 Validating receipt...`;
      
      case 'zelle_validation_success':
        return `✅ Receipt validated automatically`;
      
      case 'zelle_validation_failed':
        return `⚠️ Validation failed - manual review required`;
      
      case 'zelle_pending_manual_review':
        return `👁️ Marked for manual review`;
      
      case 'zelle_confirmation_code_saved':
        const confirmationCode = metadata?.confirmation_code || '';
        return `✅ Approved with code: ${confirmationCode}`;
      
      case 'ZELLE_PAYMENT_REJECTED':
        const rejectedZelleFile = metadata?.filename || 'document';
        return `❌ Zelle payment rejected for: ${rejectedZelleFile}`;
      
      case 'USER_ROLE_UPDATED':
        const role = metadata?.new_role || 'updated';
        return `👤 User role updated to: ${role}`;
      
      case 'DOCUMENT_EDITED':
        const editedFile = metadata?.filename || 'document';
        return `✏️ Document edited: ${editedFile}`;
      
      case 'DOCUMENT_VIEWED':
        const viewedFile = metadata?.filename || 'document';
        return `👁️ Document viewed: ${viewedFile}`;
      
      case 'DOCUMENT_DOWNLOADED':
        const downloadedFile = metadata?.filename || 'document';
        return `📥 Document downloaded: ${downloadedFile}`;
      
      case 'DOCUMENT_APPROVED':
        const approvedFileNew = metadata?.filename || 'document';
        return `✅ Document approved: ${approvedFileNew}`;
      
      case 'DOCUMENT_REJECTED':
        const rejectedFileNew = metadata?.filename || 'document';
        return `❌ Document rejected: ${rejectedFileNew}`;
      
      // duplicate of DOCUMENT_STATUS_CHANGED removed to avoid unreachable case
      
      default:
        // Para ações não mapeadas, tentar melhorar a descrição
        if (actionDescription.includes('logged in')) {
          return `🔐 User logged in successfully`;
        }
        if (actionDescription.includes('logged out')) {
          return `🚪 User logged out`;
        }
        if (actionDescription.includes('password reset')) {
          return `🔑 Password reset requested`;
        }
        return actionDescription;
    }
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata) return metadata;
    
    const formatted = { ...metadata };
    
    // Formatar campos monetários
    if (formatted.amount_total && typeof formatted.amount_total === 'number') {
      formatted.amount_total_formatted = formatCurrency(formatted.amount_total, formatted.currency);
    }
    
    // amount do create-checkout-session já vem em dólares (não dividir por 100)
    if (formatted.amount && typeof formatted.amount === 'number') {
      const currency = formatted.currency || 'usd';
      switch (currency.toLowerCase()) {
        case 'usd':
          formatted.amount_formatted = `$${formatted.amount.toFixed(2)}`;
          break;
        case 'brl':
          formatted.amount_formatted = `R$ ${formatted.amount.toFixed(2)}`;
          break;
        case 'eur':
          formatted.amount_formatted = `€${formatted.amount.toFixed(2)}`;
          break;
        default:
          formatted.amount_formatted = `${currency.toUpperCase()} ${formatted.amount.toFixed(2)}`;
      }
    }
    
    if (formatted.total_cost && typeof formatted.total_cost === 'number') {
      formatted.total_cost_formatted = formatCurrency(formatted.total_cost, formatted.currency);
    }
    
    return formatted;
  };

  const renderMetadataDetails = (metadata: any) => {
    if (!metadata) return null;

    const details = [];

    // Função para criar um item de detalhe
    const createDetail = (icon: any, label: string, value: any, color: string = 'text-gray-600') => {
      return {
        icon,
        label,
        value: String(value),
        color
      };
    };

    // Mapear TODOS os campos do metadata de forma organizada
    Object.keys(metadata).forEach(key => {
      const value = metadata[key];
      
      // Pular campos vazios ou nulos
      if (value === null || value === undefined || value === '') return;

      switch (key) {
        // Documentos
        case 'filename':
        case 'original_filename':
          details.push(createDetail(<FileText className="w-4 h-4" />, 'Document Name', value, 'text-blue-600'));
          break;
        
        case 'document_filename':
          details.push(createDetail(<FileText className="w-4 h-4" />, 'Document File', value, 'text-blue-600'));
          break;

        // Pagamentos - evitar duplicação priorizando valores formatados
        case 'amount':
          // Só mostrar se não houver amount_formatted
          if (!metadata.amount_formatted) {
            details.push(createDetail(<DollarSign className="w-4 h-4" />, 'Amount', value, 'text-green-600'));
          }
          break;
        
        case 'amount_formatted':
          details.push(createDetail(<DollarSign className="w-4 h-4" />, 'Amount', value, 'text-green-600'));
          break;
        
        case 'amount_total':
          // Só mostrar se não houver amount_total_formatted
          if (!metadata.amount_total_formatted) {
            details.push(createDetail(<DollarSign className="w-4 h-4" />, 'Total Amount', value, 'text-green-600'));
          }
          break;
        
        case 'amount_total_formatted':
          details.push(createDetail(<DollarSign className="w-4 h-4" />, 'Total Amount', value, 'text-green-600'));
          break;
        
        case 'total_cost':
          // Só mostrar se não houver total_cost_formatted
          if (!metadata.total_cost_formatted) {
            details.push(createDetail(<DollarSign className="w-4 h-4" />, 'Total Cost', value, 'text-green-600'));
          }
          break;
        
        case 'total_cost_formatted':
          details.push(createDetail(<DollarSign className="w-4 h-4" />, 'Total Cost', value, 'text-green-600'));
          break;
        
        case 'currency':
          details.push(createDetail(<CreditCard className="w-4 h-4" />, 'Currency', value.toUpperCase(), 'text-purple-600'));
          break;
        
        case 'payment_status':
          const statusIcon = value === 'succeeded' ? <CheckCircle className="w-4 h-4" /> : 
                           value === 'failed' ? <XCircle className="w-4 h-4" /> : 
                           <AlertCircle className="w-4 h-4" />;
          const statusColor = value === 'succeeded' ? 'text-green-600' : 
                             value === 'failed' ? 'text-red-600' : 'text-yellow-600';
          details.push(createDetail(statusIcon, 'Payment Status', value.charAt(0).toUpperCase() + value.slice(1), statusColor));
          break;

        // Status e mudanças
        case 'new_status':
          details.push(createDetail(<FileText className="w-4 h-4" />, 'New Status', value.charAt(0).toUpperCase() + value.slice(1), 'text-blue-600'));
          break;
        
        case 'new_role':
          details.push(createDetail(<User className="w-4 h-4" />, 'New Role', value.charAt(0).toUpperCase() + value.slice(1), 'text-purple-600'));
          break;
        
        case 'reason':
          details.push(createDetail(<AlertCircle className="w-4 h-4" />, 'Reason', value, 'text-red-600'));
          break;

        // Informações técnicas
        case 'ip':
          details.push(createDetail(<Globe className="w-4 h-4" />, 'IP Address', value, 'text-gray-600'));
          break;
        
        case 'user_agent':
          const browser = value.split(' ')[0] || 'Unknown';
          details.push(createDetail(<Shield className="w-4 h-4" />, 'Browser', browser, 'text-gray-600'));
          break;
        
        case 'session_id':
          details.push(createDetail(<Shield className="w-4 h-4" />, 'Session ID', value, 'text-gray-500'));
          break;
        
        case 'stripe_session_id':
          details.push(createDetail(<CreditCard className="w-4 h-4" />, 'Stripe Session', value, 'text-purple-600'));
          break;

        // Tempo e duração
        case 'time_spent_seconds':
          details.push(createDetail(<Clock className="w-4 h-4" />, 'Time Spent', `${value}s`, 'text-orange-600'));
          break;

        // Zelle específico
        case 'confirmation_code':
          details.push(createDetail(<CheckCircle className="w-4 h-4" />, 'Confirmation Code', value, 'text-green-600'));
          break;
        
        case 'zelle_email':
          details.push(createDetail(<User className="w-4 h-4" />, 'Zelle Email', value, 'text-blue-600'));
          break;
        
        case 'customer_email':
          details.push(createDetail(<User className="w-4 h-4" />, 'Customer Email', value, 'text-blue-600'));
          break;
        
        case 'payment_intent':
          details.push(createDetail(<CreditCard className="w-4 h-4" />, 'Payment Intent', value, 'text-purple-600'));
          break;

        // IDs e referências (mostrar completos)
        case 'document_id':
        case 'user_id':
        case 'payment_id':
          details.push(createDetail(<FileText className="w-4 h-4" />, key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), value, 'text-gray-500'));
          break;

        // Campos específicos do sistema
        case 'pages':
          details.push(createDetail(<FileText className="w-4 h-4" />, 'Pages', value, 'text-blue-600'));
          break;
        
        case 'is_certified':
          details.push(createDetail(<CheckCircle className="w-4 h-4" />, 'Is Certified', value ? 'Yes' : 'No', value ? 'text-green-600' : 'text-red-600'));
          break;
        
        case 'is_notarized':
          details.push(createDetail(<CheckCircle className="w-4 h-4" />, 'Is Notarized', value ? 'Yes' : 'No', value ? 'text-green-600' : 'text-red-600'));
          break;
        
        case 'target_language':
          details.push(createDetail(<Globe className="w-4 h-4" />, 'Target Language', value, 'text-blue-600'));
          break;
        
        case 'is_bank_statement':
          details.push(createDetail(<FileText className="w-4 h-4" />, 'Is Bank Statement', value ? 'Yes' : 'No', value ? 'text-green-600' : 'text-red-600'));
          break;
        
        case 'original_language':
          details.push(createDetail(<Globe className="w-4 h-4" />, 'Original Language', value, 'text-blue-600'));
          break;
        
        case 'timestamp':
          const date = new Date(value);
          details.push(createDetail(<Clock className="w-4 h-4" />, 'Timestamp', date.toLocaleString(), 'text-gray-600'));
          break;

        // Campos booleanos
        case 'is_manual':
        case 'is_automatic':
        case 'is_verified':
          details.push(createDetail(<CheckCircle className="w-4 h-4" />, key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), value ? 'Yes' : 'No', value ? 'text-green-600' : 'text-red-600'));
          break;

        // URL de arquivo - NÃO exibir diretamente, usar botão de visualização
        case 'file_url':
        case 'translated_file_url':
          // Não adicionar ao details - será tratado separadamente com botão de visualização
          break;
        
        // Outros campos - mostrar de forma genérica mas amigável
        default:
          // Converter snake_case para Title Case
          const friendlyLabel = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          details.push(createDetail(<FileText className="w-4 h-4" />, friendlyLabel, value, 'text-gray-600'));
          break;
      }
    });

    return details;
  };

  const getActionIcon = () => {
    switch (log.performed_by_type) {
      case 'admin':
        return '👑';
      case 'authenticator':
        return '🛡️';
      case 'finance':
        return '💰';
      case 'affiliate':
        return '👥';
      case 'system':
        return '⚙️';
      default:
        return '👤';
    }
  };

  const getActionColor = () => {
    if (log.action_type.includes('approve') || log.action_type.includes('completed')) {
      return 'bg-green-50 border-green-200';
    }
    if (log.action_type.includes('reject') || log.action_type.includes('failed')) {
      return 'bg-red-50 border-red-200';
    }
    if (log.action_type.includes('payment')) {
      return 'bg-blue-50 border-blue-200';
    }
    if (log.action_type.includes('upload')) {
      return 'bg-purple-50 border-purple-200';
    }
    if (log.action_type.includes('admin') || log.action_type.includes('role')) {
      return 'bg-yellow-50 border-yellow-200';
    }
    return 'bg-gray-50 border-gray-200';
  };

  // Função para abrir preview do documento de forma segura
  const handleViewDocument = async () => {
    const fileUrl = log.metadata?.file_url || log.metadata?.translated_file_url;
    if (!fileUrl) return;

    try {
      setPreviewLoading(true);
      setPreviewError(null);
      
      // Guardar URL original para usar no download
      setOriginalFileUrl(fileUrl);
      
      // SEMPRE gerar um novo signed URL para visualização
      const { db } = await import('../lib/supabase');
      const viewUrl = await db.generateViewUrl(fileUrl);
      
      if (!viewUrl) {
        throw new Error('Não foi possível gerar link para visualização. Verifique se você está autenticado.');
      }
      
      setPreviewUrl(viewUrl);
      setPreviewOpen(true);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to open document.');
      setPreviewOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Função para download do preview
  // IMPORTANTE: Usar a URL original do metadata, não o previewUrl (signed URL)
  const handleDownloadPreview = async () => {
    // Usar URL original do metadata, não o previewUrl
    const fileUrl = originalFileUrl || log.metadata?.file_url || log.metadata?.translated_file_url;
    if (!fileUrl) {
      alert('URL do arquivo não disponível.');
      return;
    }
    
    try {
      const filename = log.metadata?.filename || log.metadata?.document_name || 'document';
      const { extractFilePathFromUrl } = await import('../utils/fileUtils');
      
      // Extrair filePath da URL ORIGINAL, não do signed URL
      const pathInfo = extractFilePathFromUrl(fileUrl);
      
      if (!pathInfo) {
        // Se não conseguir extrair, tentar download direto da URL original
        try {
          const response = await fetch(fileUrl);
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            return;
          }
        } catch (fetchError) {
          console.error('Erro no download direto:', fetchError);
          alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
          return;
        }
      }
      
      // Usar download autenticado direto usando a URL original
      const { db } = await import('../lib/supabase');
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, filename, pathInfo.bucket);
      
      if (!success) {
        alert('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
      }
    } catch (err) {
      console.error('Error downloading preview:', err);
      alert(`Erro ao baixar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Verificar se há URL de arquivo no metadata
  const hasFileUrl = log.metadata?.file_url || log.metadata?.translated_file_url;

  const performerName = log.performed_by_name || log.performed_by_email || 'Unknown User';

  return (
    <div
      className={`border rounded-lg p-4 transition-all hover:shadow-md ${getActionColor()}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left side - Action info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-2xl">{getActionIcon()}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 break-words">
                {formatActionDescription(log.action_type, log.action_description, log.metadata)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {performerName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(log.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/60 text-gray-700 border border-gray-300">
              {log.performed_by_type === 'admin' ? '👑 Admin' :
               log.performed_by_type === 'authenticator' ? '🛡️ Authenticator' :
               log.performed_by_type === 'finance' ? '💰 Finance' :
               log.performed_by_type === 'affiliate' ? '👥 Affiliate' :
               log.performed_by_type === 'system' ? '⚙️ System' :
               '👤 User'}
            </span>
            
            {/* Action type badge com cores baseadas no tipo */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
              log.action_type.includes('approve') || log.action_type.includes('completed') || log.action_type.includes('success') ?
                'bg-green-100 text-green-800 border-green-300' :
              log.action_type.includes('reject') || log.action_type.includes('failed') || log.action_type.includes('error') ?
                'bg-red-100 text-red-800 border-red-300' :
              log.action_type.includes('payment') || log.action_type.includes('checkout') ?
                'bg-blue-100 text-blue-800 border-blue-300' :
              log.action_type.includes('upload') || log.action_type.includes('document') ?
                'bg-purple-100 text-purple-800 border-purple-300' :
              log.action_type.includes('admin') || log.action_type.includes('role') ?
                'bg-yellow-100 text-yellow-800 border-yellow-300' :
              'bg-gray-100 text-gray-800 border-gray-300'
            }`}>
              {log.action_type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            
            {log.entity_type && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/60 text-gray-700 border border-gray-300">
                📄 {log.entity_type}
              </span>
            )}
            
            {/* IP Address Badge - mais discreto */}
            {log.metadata?.ip && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                🌐 {log.metadata.ip}
              </span>
            )}
          </div>

          {/* Metadata preview */}
          {log.metadata && (
            <div className="mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ChevronDown className="w-3 h-3" />
                Click to view {Object.keys(log.metadata).length} detail{Object.keys(log.metadata).length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-start gap-2">
          {/* View entity link */}
          {log.entity_id && log.entity_type && onEntityClick && (
            <button
              onClick={() => onEntityClick(log.entity_type!, log.entity_id!)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded transition-colors"
              title={`View ${log.entity_type}`}
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          {/* Expand/Collapse metadata */}
          {log.metadata && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2 rounded-lg transition-all ${
                isExpanded 
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600'
              }`}
              title={isExpanded ? 'Hide details' : 'Show details'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

          {/* Expanded metadata */}
      {isExpanded && log.metadata && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
            <Code className="w-4 h-4" />
            Complete Details
          </div>
          
          {/* Botão para visualizar documento se houver URL */}
          {hasFileUrl && (
            <div className="mb-3">
              <button
                onClick={handleViewDocument}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Eye className="w-4 h-4" />
                View Document
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-3">
            {renderMetadataDetails(formatMetadata(log.metadata))?.map((detail, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`flex-shrink-0 mt-0.5 ${detail.color}`}>
                  {detail.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    {detail.label}
                  </p>
                  <p className="text-sm font-medium text-gray-900 break-words leading-relaxed">
                    {detail.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Modal de Preview do Documento */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000]">
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-tfe-blue-600" />
                <span className="font-semibold text-gray-900">
                  {log.metadata?.filename || log.metadata?.document_name || 'Document Preview'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                  disabled={previewLoading || !previewUrl}
                  onClick={handleDownloadPreview}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => {
                    setPreviewOpen(false);
                    setPreviewUrl(null);
                    setOriginalFileUrl(null);
                    setPreviewError(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 overflow-auto">
              {previewLoading && (
                <div className="flex items-center justify-center h-full text-gray-600">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p>Loading document...</p>
                  </div>
                </div>
              )}
              {!previewLoading && previewError && (
                <div className="p-6 text-center text-red-600">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>{previewError}</p>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <>
                  {(() => {
                    // Detectar tipo de arquivo baseado no filename ou URL
                    const filename = log.metadata?.filename || log.metadata?.document_name || '';
                    const isImage = filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) || 
                                   previewUrl.toLowerCase().includes('image') ||
                                   previewUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i);
                    
                    return isImage ? (
                      <div className="flex items-center justify-center h-full p-4">
                        <img 
                          src={previewUrl} 
                          alt={filename || 'Document'} 
                          className="max-w-full max-h-full object-contain"
                          style={{ maxHeight: 'calc(100vh - 80px)' }}
                        />
                      </div>
                    ) : (
                      <iframe src={previewUrl} className="w-full h-full border-0" title="Document Preview" />
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogItem;

