import React from 'react';
import { Clock, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Document } from '../App';

export const getStatusColor = (doc: Document) => {
  // Se tem file_url, significa que foi traduzido e está disponível para download/view
  if (doc.file_url) {
    return 'text-green-600 bg-green-50';
  }
  
  // Caso contrário, usar o status original
  switch (doc.status) {
    case 'pending':
      return 'text-yellow-600 bg-yellow-50';
    case 'pending_review':
      return 'text-orange-600 bg-orange-50';
    case 'processing':
      return 'text-tfe-blue-600 bg-tfe-blue-50';
    case 'completed':
      return 'text-green-600 bg-green-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export const getStatusIcon = (doc: Document) => {
  // Se tem file_url, significa que foi traduzido e está disponível para download/view
  if (doc.file_url) {
    return <CheckCircle className="w-4 h-4" />;
  }
  
  // Caso contrário, usar o status original
  switch (doc.status) {
    case 'pending':
      return <Clock className="w-4 h-4" />;
    case 'pending_review':
      return <Clock className="w-4 h-4" />;
    case 'processing':
      return <FileText className="w-4 h-4" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <XCircle className="w-4 h-4" />;
  }
};