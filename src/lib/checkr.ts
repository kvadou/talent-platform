/**
 * Checkr API Client
 * Documentation: https://docs.checkr.com/
 */

const CHECKR_API_KEY = process.env.CHECKR_API_KEY;
const CHECKR_API_URL = process.env.CHECKR_API_URL || 'https://api.checkr.com/v1';

// For staging/testing, use: https://api.checkr-staging.com/v1
const isConfigured = !!CHECKR_API_KEY;

// ============================================
// DEMO STUB: Returns mock data when CHECKR_API_KEY is not set
// ============================================
const MOCK_CANDIDATE: CheckrCandidate = {
  id: 'mock-checkr-candidate-1',
  object: 'candidate',
  email: 'candidate@example.com',
  first_name: 'Demo',
  last_name: 'Candidate',
  report_ids: [],
  geo_ids: [],
  created_at: new Date().toISOString(),
};

const MOCK_REPORT: CheckrReport = {
  id: 'mock-checkr-report-1',
  object: 'report',
  status: 'complete',
  result: 'clear',
  adjudication: null,
  package: 'basic_criminal',
  candidate_id: 'mock-checkr-candidate-1',
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
};

const MOCK_INVITATION: CheckrInvitation = {
  id: 'mock-checkr-invitation-1',
  object: 'invitation',
  status: 'pending',
  uri: '/invitations/mock-checkr-invitation-1',
  invitation_url: 'https://checkr.com/invitations/mock',
  candidate_id: 'mock-checkr-candidate-1',
  package: 'basic_criminal',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

interface CheckrCandidate {
  id: string;
  object: 'candidate';
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  dob?: string;
  ssn?: string;
  zipcode?: string;
  driver_license_number?: string;
  driver_license_state?: string;
  report_ids: string[];
  geo_ids: string[];
  adjudication?: string;
  created_at: string;
}

interface CheckrReport {
  id: string;
  object: 'report';
  status: 'pending' | 'processing' | 'complete' | 'canceled' | 'suspended' | 'dispute';
  result: 'clear' | 'consider' | null;
  adjudication: 'engaged' | 'adverse_action' | null;
  package: string;
  candidate_id: string;
  created_at: string;
  completed_at?: string;
  turnaround_time?: number;
}

interface CreateCandidateParams {
  email: string;
  first_name: string;
  middle_name?: string;
  no_middle_name?: boolean;
  last_name: string;
  dob?: string; // YYYY-MM-DD
  ssn?: string; // XXX-XX-XXXX
  zipcode?: string;
  driver_license_number?: string;
  driver_license_state?: string;
  phone?: string;
  work_locations?: Array<{ country: string; state?: string; city?: string }>;
}

interface CreateReportParams {
  candidate_id: string;
  package: string;
  work_locations?: Array<{ country: string; state?: string; city?: string }>;
}

interface CheckrInvitation {
  id: string;
  object: 'invitation';
  status: 'pending' | 'completed' | 'expired';
  uri: string;
  invitation_url: string;
  candidate_id: string;
  package: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
}

interface CreateInvitationParams {
  package: string;
  candidate_id?: string;
  // If no candidate_id, these are required to create a new candidate
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  work_locations?: Array<{ country: string; state?: string; city?: string }>;
}

async function checkrFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!CHECKR_API_KEY) {
    throw new Error('Checkr API key not configured');
  }

  const url = `${CHECKR_API_URL}${endpoint}`;
  const authHeader = Buffer.from(`${CHECKR_API_KEY}:`).toString('base64');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Checkr API error:', response.status, errorBody);
    throw new Error(`Checkr API error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Create a candidate in Checkr
 */
export async function createCandidate(params: CreateCandidateParams): Promise<CheckrCandidate> {
  if (!isConfigured) {
    console.log('[Checkr Stub] Returning mock candidate — set CHECKR_API_KEY to use real Checkr');
    return { ...MOCK_CANDIDATE, email: params.email, first_name: params.first_name, last_name: params.last_name };
  }
  return checkrFetch<CheckrCandidate>('/candidates', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Retrieve a candidate by ID
 */
export async function getCandidate(candidateId: string): Promise<CheckrCandidate> {
  if (!isConfigured) return { ...MOCK_CANDIDATE, id: candidateId };
  return checkrFetch<CheckrCandidate>(`/candidates/${candidateId}`);
}

/**
 * Create a background check report
 */
export async function createReport(params: CreateReportParams): Promise<CheckrReport> {
  if (!isConfigured) {
    console.log('[Checkr Stub] Returning mock report — set CHECKR_API_KEY to use real Checkr');
    return { ...MOCK_REPORT, candidate_id: params.candidate_id, package: params.package };
  }
  return checkrFetch<CheckrReport>('/reports', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Retrieve a report by ID
 */
export async function getReport(reportId: string): Promise<CheckrReport> {
  if (!isConfigured) return { ...MOCK_REPORT, id: reportId };
  return checkrFetch<CheckrReport>(`/reports/${reportId}`);
}

/**
 * Create an invitation - Checkr will email the candidate to collect their
 * sensitive information (DOB, SSN, address) directly
 */
export async function createInvitation(params: CreateInvitationParams): Promise<CheckrInvitation> {
  if (!isConfigured) {
    console.log('[Checkr Stub] Returning mock invitation — set CHECKR_API_KEY to use real Checkr');
    return MOCK_INVITATION;
  }
  return checkrFetch<CheckrInvitation>('/invitations', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Retrieve an invitation by ID
 */
export async function getInvitation(invitationId: string): Promise<CheckrInvitation> {
  if (!isConfigured) return MOCK_INVITATION;
  return checkrFetch<CheckrInvitation>(`/invitations/${invitationId}`);
}

/**
 * Get available packages for your account
 */
export async function getPackages(): Promise<{ data: Array<{ slug: string; name: string }> }> {
  if (!isConfigured) return { data: [{ slug: 'basic_criminal', name: 'Basic Criminal' }, { slug: 'standard_criminal', name: 'Standard Criminal' }] };
  return checkrFetch('/packages');
}

/**
 * Verify webhook signature from Checkr
 * Uses HMAC-SHA256 with your webhook secret
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Check if Checkr is configured
 */
export function isCheckrConfigured(): boolean {
  return isConfigured;
}

/**
 * Standard packages available (these may vary by account)
 */
export const CHECKR_PACKAGES = {
  // Common packages - actual slugs depend on your Checkr account
  TASKER_STANDARD: 'tasker_standard',
  TASKER_PRO: 'tasker_pro',
  DRIVER_STANDARD: 'driver_standard',
  DRIVER_PRO: 'driver_pro',
  BASIC: 'basic_criminal',
  STANDARD: 'standard_criminal',
} as const;

export type CheckrPackage = (typeof CHECKR_PACKAGES)[keyof typeof CHECKR_PACKAGES];
