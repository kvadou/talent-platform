/**
 * Dropbox Sign (HelloSign) API Client
 * Documentation: https://developers.hellosign.com/api/reference/
 */

const DROPBOX_SIGN_API_KEY = process.env.DROPBOX_SIGN_API_KEY;
const DROPBOX_SIGN_CLIENT_ID = process.env.DROPBOX_SIGN_CLIENT_ID;
const DROPBOX_SIGN_WEBHOOK_SECRET = process.env.ESIGN_WEBHOOK_SECRET;

const API_BASE_URL = 'https://api.hellosign.com/v3';

export function isDropboxSignConfigured(): boolean {
  return !!DROPBOX_SIGN_API_KEY;
}

// ============================================
// DEMO STUB: Returns mock data when DROPBOX_SIGN_API_KEY is not set
// ============================================
const MOCK_TEMPLATE: DropboxSignTemplate = {
  template_id: 'mock-template-1',
  title: 'Offer Letter Template',
  message: 'Please sign your offer letter',
  signer_roles: [{ name: 'Employee', order: 0 }],
  cc_roles: [],
  documents: [{ name: 'Offer Letter', index: 0 }],
  custom_fields: [],
  is_creator: true,
  can_edit: true,
};

const MOCK_SIGNATURE_REQUEST: SignatureRequest = {
  signature_request_id: 'mock-sig-request-1',
  title: 'Mock Offer Letter',
  subject: 'Your Offer Letter',
  message: 'Please sign',
  is_complete: false,
  is_declined: false,
  has_error: false,
  signing_url: 'https://app.hellosign.com/sign/mock',
  signing_redirect_url: null,
  details_url: 'https://app.hellosign.com/home/manage?guid=mock',
  requester_email_address: 'hr@example.com',
  signatures: [{
    signature_id: 'mock-sig-1',
    signer_email_address: 'candidate@example.com',
    signer_name: 'Demo Candidate',
    signer_role: 'Employee',
    order: 0,
    status_code: 'awaiting_signature',
    signed_at: null,
    last_viewed_at: null,
    last_reminded_at: null,
    error: null,
  }],
  cc_email_addresses: [],
  created_at: Math.floor(Date.now() / 1000),
  metadata: {},
};

/**
 * Make authenticated request to Dropbox Sign API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  const authHeader = Buffer.from(`${DROPBOX_SIGN_API_KEY}:`).toString('base64');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Basic ${authHeader}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.error_msg || `Dropbox Sign API error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * List available templates
 */
export async function listTemplates(): Promise<DropboxSignTemplate[]> {
  if (!DROPBOX_SIGN_API_KEY) {
    console.log('[Dropbox Sign Stub] Returning mock templates — set DROPBOX_SIGN_API_KEY to use real API');
    return [MOCK_TEMPLATE];
  }
  const response = await apiRequest<{ templates: DropboxSignTemplate[] }>(
    '/template/list?page=1&page_size=20'
  );
  return response.templates || [];
}

/**
 * Get template details
 */
export async function getTemplate(templateId: string): Promise<DropboxSignTemplate> {
  if (!DROPBOX_SIGN_API_KEY) return { ...MOCK_TEMPLATE, template_id: templateId };
  const response = await apiRequest<{ template: DropboxSignTemplate }>(
    `/template/${templateId}`
  );
  return response.template;
}

/**
 * Send signature request using a template
 */
export async function sendSignatureRequest(params: {
  templateId: string;
  signerEmail: string;
  signerName: string;
  signerRole?: string;
  subject?: string;
  message?: string;
  customFields?: Record<string, string>;
  testMode?: boolean;
  metadata?: Record<string, string>;
}): Promise<SignatureRequest> {
  if (!DROPBOX_SIGN_API_KEY) {
    console.log('[Dropbox Sign Stub] Returning mock signature request — set DROPBOX_SIGN_API_KEY to use real API');
    return {
      ...MOCK_SIGNATURE_REQUEST,
      signatures: [{
        ...MOCK_SIGNATURE_REQUEST.signatures[0],
        signer_email_address: params.signerEmail,
        signer_name: params.signerName,
      }],
    };
  }
  // Fetch template to get correct signer role name if not provided
  let signerRole = params.signerRole;
  if (!signerRole) {
    try {
      const template = await getTemplate(params.templateId);
      // Use the first signer role from the template (most templates have just one)
      if (template.signer_roles && template.signer_roles.length > 0) {
        signerRole = template.signer_roles[0].name;
      } else {
        signerRole = 'Signer'; // Fallback
      }
    } catch (error) {
      console.warn('Could not fetch template for role name, using default:', error);
      signerRole = 'Signer';
    }
  }

  const formData = new FormData();

  formData.append('template_ids[0]', params.templateId);
  formData.append('signers[0][email_address]', params.signerEmail);
  formData.append('signers[0][name]', params.signerName);
  formData.append('signers[0][role]', signerRole);

  if (params.subject) {
    formData.append('subject', params.subject);
  }

  if (params.message) {
    formData.append('message', params.message);
  }

  if (params.testMode) {
    formData.append('test_mode', '1');
  }

  if (DROPBOX_SIGN_CLIENT_ID) {
    formData.append('client_id', DROPBOX_SIGN_CLIENT_ID);
  }

  // Add custom fields (merge fields)
  if (params.customFields) {
    Object.entries(params.customFields).forEach(([key, value]) => {
      formData.append(`custom_fields[${key}]`, value);
    });
  }

  // Add metadata for tracking
  if (params.metadata) {
    Object.entries(params.metadata).forEach(([key, value]) => {
      formData.append(`metadata[${key}]`, value);
    });
  }

  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  const authHeader = Buffer.from(`${DROPBOX_SIGN_API_KEY}:`).toString('base64');

  const response = await fetch(`${API_BASE_URL}/signature_request/send_with_template`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Dropbox Sign error:', error);
    throw new Error(
      error.error?.error_msg || `Failed to send signature request: ${response.status}`
    );
  }

  const data = await response.json();
  return data.signature_request;
}

/**
 * Get signature request status
 */
export async function getSignatureRequest(requestId: string): Promise<SignatureRequest> {
  if (!DROPBOX_SIGN_API_KEY) return { ...MOCK_SIGNATURE_REQUEST, signature_request_id: requestId };
  const response = await apiRequest<{ signature_request: SignatureRequest }>(
    `/signature_request/${requestId}`
  );
  return response.signature_request;
}

/**
 * Cancel a signature request
 */
export async function cancelSignatureRequest(requestId: string): Promise<void> {
  if (!DROPBOX_SIGN_API_KEY) { console.log('[Dropbox Sign Stub] Mock cancel', requestId); return; }
  await apiRequest(`/signature_request/cancel/${requestId}`, {
    method: 'POST',
  });
}

/**
 * Get the signed document (final copy)
 */
export async function getSignedDocument(requestId: string): Promise<Buffer> {
  if (!DROPBOX_SIGN_API_KEY) {
    console.log('[Dropbox Sign Stub] Returning empty buffer for document', requestId);
    return Buffer.from('Mock signed document content');
  }

  const authHeader = Buffer.from(`${DROPBOX_SIGN_API_KEY}:`).toString('base64');

  const response = await fetch(
    `${API_BASE_URL}/signature_request/files/${requestId}`,
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download signed document: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Verify webhook signature using HMAC-SHA256
 * Dropbox Sign uses a hash_code in the event payload
 */
export function verifyWebhookSignature(
  eventTime: string,
  eventType: string,
  hashCode: string
): boolean {
  if (!DROPBOX_SIGN_WEBHOOK_SECRET) {
    console.error('No Dropbox Sign webhook secret configured — rejecting unverified event');
    return false;
  }

  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', DROPBOX_SIGN_WEBHOOK_SECRET);
  hmac.update(`${eventTime}${eventType}`);
  const expectedHash = hmac.digest('hex');

  return hashCode === expectedHash;
}

// Types

export interface DropboxSignTemplate {
  template_id: string;
  title: string;
  message: string;
  signer_roles: Array<{
    name: string;
    order: number;
  }>;
  cc_roles: Array<{
    name: string;
  }>;
  documents: Array<{
    name: string;
    index: number;
  }>;
  custom_fields: Array<{
    name: string;
    type: string;
  }>;
  is_creator: boolean;
  can_edit: boolean;
}

export interface SignatureRequest {
  signature_request_id: string;
  title: string;
  subject: string;
  message: string;
  is_complete: boolean;
  is_declined: boolean;
  has_error: boolean;
  signing_url: string | null;
  signing_redirect_url: string | null;
  details_url: string;
  requester_email_address: string;
  signatures: Array<{
    signature_id: string;
    signer_email_address: string;
    signer_name: string;
    signer_role: string | null;
    order: number | null;
    status_code: string; // "awaiting_signature", "signed", "declined"
    signed_at: number | null;
    last_viewed_at: number | null;
    last_reminded_at: number | null;
    error: string | null;
  }>;
  cc_email_addresses: string[];
  created_at: number;
  metadata: Record<string, string>;
}

export interface DropboxSignWebhookEvent {
  event: {
    event_time: string;
    event_type: string;
    event_hash: string;
    event_metadata: {
      related_signature_id?: string;
      reported_for_account_id?: string;
    };
  };
  signature_request?: SignatureRequest;
  account_id?: string;
}
