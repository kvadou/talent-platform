import { prisma } from './prisma';
import { encrypt, decrypt } from './security/encryption';

// ============================================
// DEMO STUB: Returns mock data when Zoom env vars are not set
// ============================================
const ZOOM_CONFIGURED = !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);

const MOCK_MEETING: ZoomMeetingResponse = {
  id: 'mock-zoom-meeting-123',
  join_url: 'https://zoom.us/j/mock-meeting',
  start_url: 'https://zoom.us/s/mock-meeting',
  password: 'mockpass',
  topic: 'Mock Interview Meeting',
  start_time: new Date().toISOString(),
  duration: 30,
};

const MOCK_USER: ZoomUser = {
  id: 'mock-user-1',
  email: 'interviewer@example.com',
  first_name: 'Demo',
  last_name: 'Interviewer',
  display_name: 'Demo Interviewer',
  type: 2,
  status: 'active',
};

interface ZoomMeetingOptions {
  topic: string;
  startTime: Date;
  duration: number; // in minutes
  timezone?: string;
  password?: string;
  hostEmail?: string; // Email of the Zoom user who will host the meeting
  settings?: {
    hostVideo?: boolean;
    participantVideo?: boolean;
    joinBeforeHost?: boolean;
    muteUponEntry?: boolean;
    waitingRoom?: boolean;
    autoRecording?: 'none' | 'local' | 'cloud';
  };
}

interface ZoomUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  type: number; // 1 = Basic, 2 = Licensed, 3 = On-prem
  status: string; // active, inactive, pending
}

interface ZoomUsersResponse {
  users: ZoomUser[];
  page_count: number;
  page_number: number;
  page_size: number;
  total_records: number;
}

interface ZoomMeetingResponse {
  id: string;
  join_url: string;
  start_url: string;
  password?: string;
  topic: string;
  start_time: string;
  duration: number;
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Get Zoom API access token using Server-to-Server OAuth
 * Uses OAuth 2.0 with account credentials
 */
async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      'Zoom API credentials not configured. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET environment variables.'
    );
  }

  // Check if we have a cached token in IntegrationToken table
  const cachedToken = await prisma.integrationToken.findUnique({
    where: { service: 'zoom' },
  });

  // Use cached token if it's still valid (with 5 minute buffer)
  if (cachedToken?.tokenValue && cachedToken.expiresAt) {
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    if (new Date(cachedToken.expiresAt.getTime() - bufferTime) > new Date()) {
      return decrypt(cachedToken.tokenValue);
    }
  }

  // Exchange credentials for access token
  const tokenUrl = 'https://zoom.us/oauth/token';
  
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: accountId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Failed to get Zoom access token: ${error.error_description || error.message || response.statusText}`);
  }

  const tokenData: ZoomTokenResponse = await response.json();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in - 60) * 1000); // Subtract 1 minute buffer

  // Cache the token (encrypted at rest)
  const encryptedToken = encrypt(tokenData.access_token);
  await prisma.integrationToken.upsert({
    where: { service: 'zoom' },
    create: {
      service: 'zoom',
      tokenType: 'access_token',
      tokenValue: encryptedToken,
      expiresAt,
    },
    update: {
      tokenValue: encryptedToken,
      expiresAt,
    },
  });

  return tokenData.access_token;
}

/**
 * Make authenticated request to Zoom API
 */
async function zoomApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getZoomAccessToken();
  const zoomApiUrl = process.env.ZOOM_API_URL || 'https://api.zoom.us/v2';
  const accountId = process.env.ZOOM_ACCOUNT_ID;

  if (!accountId) {
    throw new Error('Zoom Account ID not configured');
  }

  const url = `${zoomApiUrl}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Zoom API error: ${error.message || response.statusText} (${response.status})`);
  }

  return response.json();
}

/**
 * List Zoom users in the account
 */
export async function listZoomUsers(): Promise<ZoomUser[]> {
  if (!ZOOM_CONFIGURED) return [MOCK_USER];
  const response = await zoomApiRequest<ZoomUsersResponse>('/users?status=active&page_size=300');
  return response.users || [];
}

/**
 * Get a Zoom user by email
 */
export async function getZoomUserByEmail(email: string): Promise<ZoomUser | null> {
  if (!ZOOM_CONFIGURED) return { ...MOCK_USER, email };
  try {
    const user = await zoomApiRequest<ZoomUser>(`/users/${email}`);
    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Create a Zoom meeting
 */
export async function createZoomMeeting(options: ZoomMeetingOptions): Promise<ZoomMeetingResponse> {
  if (!ZOOM_CONFIGURED) {
    console.log('[Zoom Stub] Returning mock meeting data — set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET to use real Zoom');
    return { ...MOCK_MEETING, topic: options.topic, duration: options.duration, start_time: options.startTime.toISOString() };
  }
  const {
    topic,
    startTime,
    duration,
    timezone = 'America/Chicago',
    password,
    hostEmail,
    settings = {}
  } = options;

  const meetingData = {
    topic,
    type: 2, // Scheduled meeting
    start_time: startTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    duration,
    timezone,
    password: password || generateRandomPassword(),
    settings: {
      host_video: settings.hostVideo ?? true,
      participant_video: settings.participantVideo ?? true,
      join_before_host: settings.joinBeforeHost ?? false,
      mute_upon_entry: settings.muteUponEntry ?? false,
      waiting_room: settings.waitingRoom ?? false,
      auto_recording: settings.autoRecording || 'none',
      ...settings
    }
  };

  // Use specific user endpoint if hostEmail is provided, otherwise use /me
  const endpoint = hostEmail ? `/users/${hostEmail}/meetings` : '/users/me/meetings';

  const response = await zoomApiRequest<ZoomMeetingResponse>(
    endpoint,
    {
      method: 'POST',
      body: JSON.stringify(meetingData),
    }
  );

  return response;
}

/**
 * Get a Zoom meeting by ID
 */
export async function getZoomMeeting(meetingId: string): Promise<ZoomMeetingResponse> {
  if (!ZOOM_CONFIGURED) return { ...MOCK_MEETING, id: meetingId };
  return zoomApiRequest<ZoomMeetingResponse>(`/meetings/${meetingId}`);
}

/**
 * Update a Zoom meeting
 */
export async function updateZoomMeeting(
  meetingId: string,
  updates: Partial<ZoomMeetingOptions>
): Promise<void> {
  if (!ZOOM_CONFIGURED) { console.log('[Zoom Stub] Mock update meeting', meetingId); return; }
  const meetingData: any = {};

  if (updates.topic) meetingData.topic = updates.topic;
  if (updates.startTime) {
    meetingData.start_time = updates.startTime.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  if (updates.duration) meetingData.duration = updates.duration;
  if (updates.timezone) meetingData.timezone = updates.timezone;
  if (updates.password) meetingData.password = updates.password;
  if (updates.settings) {
    meetingData.settings = {
      host_video: updates.settings.hostVideo,
      participant_video: updates.settings.participantVideo,
      join_before_host: updates.settings.joinBeforeHost,
      mute_upon_entry: updates.settings.muteUponEntry,
      waiting_room: updates.settings.waitingRoom,
      auto_recording: updates.settings.autoRecording,
    };
  }

  await zoomApiRequest(`/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(meetingData),
  });
}

/**
 * Delete a Zoom meeting
 */
export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  if (!ZOOM_CONFIGURED) { console.log('[Zoom Stub] Mock delete meeting', meetingId); return; }
  await zoomApiRequest(`/meetings/${meetingId}`, {
    method: 'DELETE',
  });
}

/**
 * Generate a random password for Zoom meetings
 */
function generateRandomPassword(): string {
  return Math.random().toString(36).slice(-10).toUpperCase();
}

// ============================================
// RECORDING FUNCTIONS
// ============================================

interface ZoomRecording {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_extension: string;
  file_size: number;
  play_url: string;
  download_url: string;
  status: string;
  recording_type: string;
}

interface ZoomRecordingsResponse {
  uuid: string;
  id: number;
  host_id: string;
  topic: string;
  start_time: string;
  duration: number;
  total_size: number;
  recording_count: number;
  recording_files: ZoomRecording[];
  download_access_token?: string;
}

/**
 * Get recordings for a specific meeting
 */
export async function getZoomMeetingRecordings(meetingId: string): Promise<ZoomRecordingsResponse | null> {
  if (!ZOOM_CONFIGURED) return null;
  try {
    const response = await zoomApiRequest<ZoomRecordingsResponse>(
      `/meetings/${meetingId}/recordings`
    );
    return response;
  } catch (error) {
    console.error('Failed to get Zoom recordings:', error);
    return null;
  }
}

/**
 * Get a download URL for a Zoom recording file
 * Zoom cloud recording URLs require authentication
 */
export async function getZoomRecordingDownloadUrl(downloadUrl: string): Promise<string> {
  const token = await getZoomAccessToken();
  // Append access token to download URL
  const separator = downloadUrl.includes('?') ? '&' : '?';
  return `${downloadUrl}${separator}access_token=${token}`;
}

/**
 * Download a Zoom recording file as a buffer
 */
export async function downloadZoomRecording(downloadUrl: string): Promise<Buffer> {
  const authenticatedUrl = await getZoomRecordingDownloadUrl(downloadUrl);

  const response = await fetch(authenticatedUrl, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to download recording: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete recordings for a meeting (after successfully storing in S3)
 */
export async function deleteZoomMeetingRecordings(meetingId: string): Promise<void> {
  try {
    await zoomApiRequest(`/meetings/${meetingId}/recordings`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to delete Zoom recordings:', error);
    // Don't throw - deletion is optional cleanup
  }
}

/**
 * Create a Zoom meeting for an interview
 */
export async function createInterviewZoomMeeting(
  interviewId: string,
  candidateName: string,
  interviewerName: string,
  jobTitle: string,
  scheduledAt: Date,
  duration: number,
  hostEmail?: string, // Optional Zoom host email
  recordingEnabled: boolean = true // Enable cloud recording by default
): Promise<{ meetingId: string; joinUrl: string; startUrl: string; password?: string }> {
  const topic = `Interview: ${candidateName} - ${jobTitle}`;

  const meeting = await createZoomMeeting({
    topic,
    startTime: scheduledAt,
    duration,
    timezone: 'America/Chicago',
    hostEmail,
    settings: {
      hostVideo: true,
      participantVideo: true,
      joinBeforeHost: false,
      muteUponEntry: false,
      waitingRoom: true, // Enable waiting room for security
      autoRecording: recordingEnabled ? 'cloud' : 'none', // Cloud recording for automatic transcription
    },
  });

  // Store the meeting link and ID in the interview record
  // Note: Zoom API returns meeting ID as a number, but we store it as a string
  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      meetingLink: meeting.join_url,
      zoomMeetingId: String(meeting.id), // Convert to string for Prisma
    },
  });

  return {
    meetingId: String(meeting.id),
    joinUrl: meeting.join_url,
    startUrl: meeting.start_url,
    password: meeting.password,
  };
}

