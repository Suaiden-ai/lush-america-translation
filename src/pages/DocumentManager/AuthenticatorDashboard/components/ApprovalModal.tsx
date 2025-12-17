import { CheckCircle } from 'lucide-react';

interface ApprovalModalProps {
  isOpen: boolean;
  documentName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ApprovalModal({ isOpen, documentName, onConfirm, onCancel }: ApprovalModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{
          margin: '0 auto 1rem',
          width: '48px',
          height: '48px',
          backgroundColor: '#dcfce7',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CheckCircle style={{ width: '24px', height: '24px', color: '#16a34a' }} />
        </div>
        
        <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '8px' }}>
          Confirm Approval
        </h3>
        
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
          Are you sure you want to approve the document "{documentName}"? This action cannot be undone.
        </p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white',
              backgroundColor: '#16a34a',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
