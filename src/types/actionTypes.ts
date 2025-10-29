/**
 * Standardized action types for the logging system
 * These constants ensure consistency across the application
 */

export const ActionTypes = {
  // Authentication actions
  AUTH: {
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    USER_REGISTER: 'user_register',
    PASSWORD_RESET: 'password_reset',
    PASSWORD_RESET_REQUEST: 'password_reset_request',
    LOGIN_FAILED: 'login_failed',
  },

  // Document actions
  DOCUMENT: {
    UPLOAD: 'document_upload',
    UPLOADED: 'DOCUMENT_UPLOADED',
    UPLOAD_FAILED: 'DOCUMENT_UPLOAD_FAILED', // New
    APPROVE: 'document_approve',
    APPROVED: 'DOCUMENT_APPROVED', // New
    REJECT: 'document_reject',
    REJECTED: 'DOCUMENT_REJECTED', // New
    DELETE: 'document_delete',
    UPDATE: 'document_update',
    DOWNLOAD: 'document_download',
    VIEW: 'document_view',
    SEND_FOR_AUTHENTICATION: 'document_send_for_authentication',
    CORRECTION_SENT: 'document_correction_sent',
    READY_FOR_AUTHENTICATION: 'DOCUMENT_READY_FOR_AUTHENTICATION',
    MANUAL_UPLOAD_BY_AUTHENTICATOR: 'DOCUMENT_MANUAL_UPLOAD_BY_AUTHENTICATOR',
    DELIVERED: 'DOCUMENT_DELIVERED',
    STATUS_CHANGED: 'DOCUMENT_STATUS_CHANGED',
    VIEWED: 'DOCUMENT_VIEWED',
    DOWNLOADED: 'DOCUMENT_DOWNLOADED',
  },

  // Payment actions
  PAYMENT: {
    CREATED: 'payment_created',
    COMPLETED: 'payment_completed',
    CANCELLED: 'payment_cancelled',
    REFUNDED: 'payment_refunded',
    FAILED: 'payment_failed', // New
    STRIPE_COMPLETED: 'stripe_payment_completed',
    ZELLE_CREATED: 'zelle_payment_created',
    ZELLE_VERIFIED: 'zelle_payment_verified',
    ZELLE_REJECTED: 'zelle_payment_rejected',
    ZELLE_CONFIRMATION_CODE_SET: 'zelle_confirmation_code_set',
    CHECKOUT_CREATED: 'CHECKOUT_CREATED',
    CHECKOUT_STARTED: 'CHECKOUT_STARTED', // New
    CHECKOUT_ABANDONED: 'CHECKOUT_ABANDONED', // New
    PROCESSING: 'PAYMENT_PROCESSING',
    RECEIVED: 'PAYMENT_RECEIVED',
    ZELLE_SELECTED: 'zelle_selected',
    ZELLE_CHECKOUT_OPENED: 'zelle_checkout_opened',
    ZELLE_RECEIPT_ATTACHED: 'zelle_receipt_attached',
    ZELLE_RECEIPT_UPLOADED: 'zelle_receipt_uploaded',
    ZELLE_RECEIPT_UPLOAD_FAILED: 'zelle_receipt_upload_failed',
    ZELLE_VALIDATION_ATTEMPTED: 'zelle_validation_attempted',
    ZELLE_VALIDATION_SUCCESS: 'zelle_validation_success',
    ZELLE_VALIDATION_FAILED: 'zelle_validation_failed',
    ZELLE_PENDING_MANUAL_REVIEW: 'zelle_pending_manual_review',
    ZELLE_CONFIRMATION_CODE_SAVED: 'zelle_confirmation_code_saved',
  },

  // Admin actions
  ADMIN: {
    USER_ROLE_CHANGED: 'user_role_changed',
    USER_PROFILE_UPDATED: 'user_profile_updated',
    USER_DELETED: 'user_deleted',
    DOCUMENT_INFO_EDITED: 'document_info_edited',
    USER_INFO_EDITED: 'user_info_edited',
    PAYMENT_CANCELLED: 'payment_cancelled_by_admin',
    PAYMENT_REFUNDED: 'payment_refunded_by_admin',
  },

  // System actions
  SYSTEM: {
    EMAIL_SENT: 'email_sent',
    NOTIFICATION_SENT: 'notification_sent',
    REPORT_GENERATED: 'report_generated',
    BATCH_PROCESSING_STARTED: 'batch_processing_started',
    BATCH_PROCESSING_COMPLETED: 'batch_processing_completed',
  },
} as const;

/**
 * Human-readable action type labels
 */
export const ActionTypeLabels: Record<string, string> = {
  // Auth
  [ActionTypes.AUTH.USER_LOGIN]: 'User Login',
  [ActionTypes.AUTH.USER_LOGOUT]: 'User Logout',
  [ActionTypes.AUTH.USER_REGISTER]: 'User Registration',
  [ActionTypes.AUTH.PASSWORD_RESET]: 'Password Reset',
  [ActionTypes.AUTH.PASSWORD_RESET_REQUEST]: 'Password Reset Request',
  [ActionTypes.AUTH.LOGIN_FAILED]: 'Login Failed',
  
  // Documents
  [ActionTypes.DOCUMENT.UPLOAD]: 'Document Upload',
  [ActionTypes.DOCUMENT.UPLOADED]: 'Document Uploaded',
  [ActionTypes.DOCUMENT.UPLOAD_FAILED]: 'Document Upload Failed',
  [ActionTypes.DOCUMENT.APPROVE]: 'Document Approved',
  [ActionTypes.DOCUMENT.APPROVED]: 'Document Approved',
  [ActionTypes.DOCUMENT.REJECT]: 'Document Rejected',
  [ActionTypes.DOCUMENT.REJECTED]: 'Document Rejected',
  [ActionTypes.DOCUMENT.DELETE]: 'Document Deleted',
  [ActionTypes.DOCUMENT.UPDATE]: 'Document Updated',
  [ActionTypes.DOCUMENT.DOWNLOAD]: 'Document Downloaded',
  [ActionTypes.DOCUMENT.VIEW]: 'Document Viewed',
  [ActionTypes.DOCUMENT.SEND_FOR_AUTHENTICATION]: 'Document Sent for Authentication',
  [ActionTypes.DOCUMENT.CORRECTION_SENT]: 'Correction Sent',
  [ActionTypes.DOCUMENT.READY_FOR_AUTHENTICATION]: 'Document Ready for Authentication',
  [ActionTypes.DOCUMENT.MANUAL_UPLOAD_BY_AUTHENTICATOR]: 'Manual Upload by Authenticator',
  [ActionTypes.DOCUMENT.DELIVERED]: 'Document Delivered',
  [ActionTypes.DOCUMENT.STATUS_CHANGED]: 'Document Status Changed',
  [ActionTypes.DOCUMENT.VIEWED]: 'Document Viewed',
  [ActionTypes.DOCUMENT.DOWNLOADED]: 'Document Downloaded',
  
  // Payments
  [ActionTypes.PAYMENT.CREATED]: 'Payment Created',
  [ActionTypes.PAYMENT.COMPLETED]: 'Payment Completed',
  [ActionTypes.PAYMENT.CANCELLED]: 'Payment Cancelled',
  [ActionTypes.PAYMENT.REFUNDED]: 'Payment Refunded',
  [ActionTypes.PAYMENT.STRIPE_COMPLETED]: 'Stripe Payment Completed',
  [ActionTypes.PAYMENT.ZELLE_CREATED]: 'Zelle Payment Created',
  [ActionTypes.PAYMENT.ZELLE_VERIFIED]: 'Zelle Payment Verified',
  [ActionTypes.PAYMENT.ZELLE_REJECTED]: 'Zelle Payment Rejected',
  [ActionTypes.PAYMENT.ZELLE_CONFIRMATION_CODE_SET]: 'Zelle Confirmation Code Set',
  [ActionTypes.PAYMENT.ZELLE_SELECTED]: 'Zelle Payment Method Selected',
  [ActionTypes.PAYMENT.ZELLE_CHECKOUT_OPENED]: 'Zelle Checkout Opened',
  [ActionTypes.PAYMENT.ZELLE_RECEIPT_ATTACHED]: 'Zelle Receipt Attached',
  [ActionTypes.PAYMENT.ZELLE_RECEIPT_UPLOADED]: 'Zelle Receipt Uploaded',
  [ActionTypes.PAYMENT.ZELLE_RECEIPT_UPLOAD_FAILED]: 'Zelle Receipt Upload Failed',
  [ActionTypes.PAYMENT.ZELLE_VALIDATION_ATTEMPTED]: 'Zelle Validation Attempted',
  [ActionTypes.PAYMENT.ZELLE_VALIDATION_SUCCESS]: 'Zelle Validation Success',
  [ActionTypes.PAYMENT.ZELLE_VALIDATION_FAILED]: 'Zelle Validation Failed',
  [ActionTypes.PAYMENT.ZELLE_PENDING_MANUAL_REVIEW]: 'Zelle Pending Manual Review',
  [ActionTypes.PAYMENT.ZELLE_CONFIRMATION_CODE_SAVED]: 'Zelle Confirmation Code Saved',
  
  // Admin
  [ActionTypes.ADMIN.USER_ROLE_CHANGED]: 'User Role Changed',
  [ActionTypes.ADMIN.USER_PROFILE_UPDATED]: 'User Profile Updated',
  [ActionTypes.ADMIN.USER_DELETED]: 'User Deleted',
  [ActionTypes.ADMIN.DOCUMENT_INFO_EDITED]: 'Document Info Edited',
  [ActionTypes.ADMIN.USER_INFO_EDITED]: 'User Info Edited',
  [ActionTypes.ADMIN.PAYMENT_CANCELLED]: 'Payment Cancelled by Admin',
  [ActionTypes.ADMIN.PAYMENT_REFUNDED]: 'Payment Refunded by Admin',
  
  // System
  [ActionTypes.SYSTEM.EMAIL_SENT]: 'Email Sent',
  [ActionTypes.SYSTEM.NOTIFICATION_SENT]: 'Notification Sent',
  [ActionTypes.SYSTEM.REPORT_GENERATED]: 'Report Generated',
  [ActionTypes.SYSTEM.BATCH_PROCESSING_STARTED]: 'Batch Processing Started',
  [ActionTypes.SYSTEM.BATCH_PROCESSING_COMPLETED]: 'Batch Processing Completed',
};

/**
 * Action type categories for filtering
 */
export const ActionCategories = {
  ALL: 'all',
  AUTH: 'auth',
  DOCUMENT: 'document',
  PAYMENT: 'payment',
  ADMIN: 'admin',
  SYSTEM: 'system',
} as const;

