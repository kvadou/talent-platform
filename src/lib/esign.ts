/**
 * STC E-Sign API Client
 * Internal e-signature platform at sign.acmetalent.com
 */

const ESIGN_API_KEY = process.env.ESIGN_API_KEY;
const ESIGN_BASE_URL = process.env.ESIGN_BASE_URL || 'https://sign.acmetalent.com';
const ESIGN_WEBHOOK_SECRET = process.env.ESIGN_WEBHOOK_SECRET;

export function isESignConfigured(): boolean {
  return !!ESIGN_API_KEY;
}

// ============================================
// DEMO STUB: Returns mock data when ESIGN_API_KEY is not set
// ============================================
const MOCK_ESIGN_TEMPLATE: ESignTemplate = {
  id: 'mock-esign-template-1',
  name: 'Offer Letter',
  description: 'Standard offer letter template',
  status: 'ACTIVE',
  signerRoles: [{ id: 'role-1', name: 'Employee', order: 0 }],
  fields: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_ESIGN_DOCUMENT: ESignDocument = {
  id: 'mock-esign-doc-1',
  title: 'Mock Offer Letter',
  status: 'SENT',
  signingOrderType: 'PARALLEL',
  signers: [{
    id: 'mock-signer-1',
    name: 'Demo Candidate',
    email: 'candidate@example.com',
    role: 'Employee',
    signingOrder: 0,
    status: 'PENDING',
    embedUrl: 'https://sign.example.com/embed/mock',
    signUrl: 'https://sign.example.com/sign/mock',
  }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Make authenticated request to E-Sign API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!ESIGN_API_KEY) {
    throw new Error('E-Sign API key not configured');
  }

  const response = await fetch(`${ESIGN_BASE_URL}/api/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ESIGN_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `E-Sign API error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * List available templates
 */
export async function listTemplates(): Promise<ESignTemplate[]> {
  if (!ESIGN_API_KEY) {
    console.log('[E-Sign Stub] Returning mock templates — set ESIGN_API_KEY to use real API');
    return [MOCK_ESIGN_TEMPLATE];
  }
  const response = await apiRequest<{ templates: ESignTemplate[] }>('/templates');
  return response.templates || [];
}

/**
 * Get template details
 */
export async function getTemplate(templateId: string): Promise<ESignTemplate> {
  if (!ESIGN_API_KEY) return { ...MOCK_ESIGN_TEMPLATE, id: templateId };
  const response = await apiRequest<{ template: ESignTemplate }>(
    `/templates/${templateId}`
  );
  return response.template;
}

/**
 * Create a document from a template and send for signature
 */
export async function createDocument(params: {
  templateId: string;
  title: string;
  signers: Array<{
    name: string;
    email: string;
    role: string;
    order?: number;
  }>;
  mergeData?: Record<string, string>;
  signingOrderType?: 'SEQUENTIAL' | 'PARALLEL';
  emailSubject?: string;
  emailMessage?: string;
  metadata?: Record<string, string>;
}): Promise<ESignDocument> {
  if (!ESIGN_API_KEY) {
    console.log('[E-Sign Stub] Returning mock document — set ESIGN_API_KEY to use real API');
    return { ...MOCK_ESIGN_DOCUMENT, title: params.title };
  }
  const response = await apiRequest<{ document: ESignDocument }>('/documents', {
    method: 'POST',
    body: JSON.stringify({
      templateId: params.templateId,
      title: params.title,
      signers: params.signers,
      mergeData: params.mergeData,
      signingOrderType: params.signingOrderType || 'PARALLEL',
      emailSubject: params.emailSubject,
      emailMessage: params.emailMessage,
      metadata: params.metadata,
    }),
  });
  return response.document;
}

/**
 * Get document status
 */
export async function getDocumentStatus(documentId: string): Promise<ESignDocument> {
  if (!ESIGN_API_KEY) return { ...MOCK_ESIGN_DOCUMENT, id: documentId };
  const response = await apiRequest<{ document: ESignDocument }>(
    `/documents/${documentId}`
  );
  return response.document;
}

/**
 * Void/cancel a document
 */
export async function voidDocument(documentId: string): Promise<void> {
  if (!ESIGN_API_KEY) { console.log('[E-Sign Stub] Mock void document', documentId); return; }
  await apiRequest(`/documents/${documentId}`, {
    method: 'DELETE',
  });
}

/**
 * Send reminder to pending signers
 */
export async function remindSigners(documentId: string): Promise<void> {
  if (!ESIGN_API_KEY) { console.log('[E-Sign Stub] Mock remind signers', documentId); return; }
  await apiRequest(`/documents/${documentId}/remind`, {
    method: 'POST',
  });
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!ESIGN_WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('No E-Sign webhook secret configured in production — rejecting');
      return false;
    }
    console.warn('No E-Sign webhook secret configured, skipping verification in dev');
    return true;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', ESIGN_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

// Types

export interface ESignTemplate {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  signerRoles: Array<{
    id: string;
    name: string;
    order: number;
  }>;
  fields: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    signerRoleId: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ESignSigner {
  id: string;
  name: string;
  email: string;
  role: string;
  signingOrder: number;
  status: 'PENDING' | 'SENT' | 'VIEWED' | 'SIGNED' | 'DECLINED';
  signedAt?: string;
  declinedAt?: string;
  viewedAt?: string;
  embedUrl: string;
  signUrl: string;
}

export interface ESignDocument {
  id: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_SIGNED' | 'COMPLETED' | 'VOIDED' | 'EXPIRED';
  signingOrderType: 'SEQUENTIAL' | 'PARALLEL';
  signers: ESignSigner[];
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ESignWebhookEvent {
  event: string;
  timestamp: string;
  document: {
    id: string;
    title: string;
    status: string;
  };
  signer?: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  metadata?: Record<string, string>;
}
