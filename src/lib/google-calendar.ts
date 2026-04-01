import { google } from 'googleapis';
import { prisma } from './prisma';
import { encrypt, decrypt } from './security/encryption';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
);

/**
 * Get Google Service Account client with domain-wide delegation
 * This allows accessing any user's calendar without individual OAuth
 */
function getServiceAccountClient(userEmail?: string) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    return null;
  }

  try {
    const keyData = JSON.parse(serviceAccountJson);

    const jwtClient = new google.auth.JWT({
      email: keyData.client_email,
      key: keyData.private_key,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      subject: userEmail,
    });

    return jwtClient;
  } catch (error) {
    console.error('Failed to create service account client:', error);
    return null;
  }
}

export function getGoogleAuthUrl(userId: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userId,
    prompt: 'consent'
  });
}

export async function handleGoogleCallback(code: string, userId: string) {
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get tokens from Google');
  }

  // Get user info to find calendar
  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarList = await calendar.calendarList.list();
  const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary) || calendarList.data.items?.[0];

  // Store integration
  await prisma.calendarIntegration.upsert({
    where: {
      userId_provider: {
        userId,
        provider: 'google'
      }
    },
    create: {
      userId,
      provider: 'google',
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      calendarId: primaryCalendar?.id || null,
      isActive: true
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      calendarId: primaryCalendar?.id || null,
      isActive: true
    }
  });

  return { success: true };
}

export async function getCalendarClient(userId: string) {
  const integration = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'google'
      }
    }
  });

  if (!integration || !integration.isActive) {
    throw new Error('Google Calendar not connected');
  }

  const decryptedAccessToken = decrypt(integration.accessToken);
  const decryptedRefreshToken = integration.refreshToken ? decrypt(integration.refreshToken) : undefined;

  // Refresh token if expired
  if (integration.expiresAt && integration.expiresAt < new Date()) {
    oauth2Client.setCredentials({
      refresh_token: decryptedRefreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    await prisma.calendarIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: credentials.access_token ? encrypt(credentials.access_token) : integration.accessToken,
        refreshToken: credentials.refresh_token ? encrypt(credentials.refresh_token) : integration.refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : integration.expiresAt
      }
    });

    oauth2Client.setCredentials(credentials);
  } else {
    oauth2Client.setCredentials({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken
    });
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function createCalendarEvent(
  userId: string,
  summary: string,
  description: string,
  startTime: Date,
  endTime: Date,
  attendeeEmails: string[],
  options?: {
    location?: string;
    addGoogleMeet?: boolean;
    sendUpdates?: 'all' | 'externalOnly' | 'none';
  }
) {
  const calendar = await getCalendarClient(userId);
  const integration = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'google'
      }
    }
  });

  const event: any = {
    summary,
    description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/Chicago'
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/Chicago'
    },
    attendees: attendeeEmails.map((email) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 15 } // 15 minutes before
      ]
    }
  };

  if (options?.location) {
    event.location = options.location;
  }

  // Add Google Meet video conferencing
  if (options?.addGoogleMeet) {
    event.conferenceData = {
      createRequest: {
        requestId: `interview-${Date.now()}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet'
        }
      }
    };
  }

  const response = await calendar.events.insert({
    calendarId: integration?.calendarId || 'primary',
    requestBody: event,
    conferenceDataVersion: options?.addGoogleMeet ? 1 : undefined,
    sendUpdates: options?.sendUpdates || 'all'
  });

  return response.data;
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    attendeeEmails?: string[];
    location?: string;
  }
) {
  const calendar = await getCalendarClient(userId);
  const integration = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'google'
      }
    }
  });

  const event: any = {};

  if (updates.summary) event.summary = updates.summary;
  if (updates.description) event.description = updates.description;
  if (updates.location) event.location = updates.location;
  if (updates.attendeeEmails) {
    event.attendees = updates.attendeeEmails.map((email) => ({ email }));
  }
  if (updates.startTime) {
    event.start = {
      dateTime: updates.startTime.toISOString(),
      timeZone: 'America/Chicago'
    };
  }
  if (updates.endTime) {
    event.end = {
      dateTime: updates.endTime.toISOString(),
      timeZone: 'America/Chicago'
    };
  }

  const response = await calendar.events.patch({
    calendarId: integration?.calendarId || 'primary',
    eventId,
    requestBody: event,
    sendUpdates: 'all'
  });

  return response.data;
}

export async function getAvailableTimeSlots(
  userId: string,
  interviewerIds: string[],
  durationMinutes: number,
  startDate: Date,
  endDate: Date,
  bufferBefore: number = 15,
  bufferAfter: number = 15,
  interviewerEmails?: string[] // Optional: provide emails for service account impersonation
) {
  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  // Try service account first (admin access - no individual OAuth needed)
  const serviceAccountClient = getServiceAccountClient();
  
  if (serviceAccountClient && interviewerEmails && interviewerEmails.length > 0) {
    try {
      // Use service account to check calendars for all interviewers
      const calendar = google.calendar({ version: 'v3', auth: serviceAccountClient });
      
      // Build freebusy items using email addresses
      const freebusyItems = interviewerEmails.map((email) => ({ id: email }));
      
      const busyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items: freebusyItems
        }
      });

      return generateAvailableSlots(
        busyResponse.data,
        startDate,
        endDate,
        durationMinutes,
        bufferBefore,
        bufferAfter
      );
    } catch (error) {
      console.error('Service account calendar check failed, falling back to OAuth:', error);
      // Fall through to OAuth method
    }
  }

  // Fallback to OAuth method (requires individual calendar connections)
  const calendar = await getCalendarClient(userId);
  const integration = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'google'
      }
    }
  });

  // Fetch calendar integrations for all interviewers
  const interviewerIntegrations = await Promise.all(
    interviewerIds.map(async (id) => {
      const userIntegration = await prisma.calendarIntegration.findUnique({
        where: {
          userId_provider: {
            userId: id,
            provider: 'google'
          }
        }
      });
      return { userId: id, integration: userIntegration };
    })
  );

  // Build items array for freebusy query - use each interviewer's calendar if available
  const freebusyItems = interviewerIntegrations.map(({ userId, integration }) => {
    if (integration?.calendarId) {
      return { id: integration.calendarId };
    }
    return { id: integration?.calendarId || 'primary' };
  });

  // If no interviewer calendars found, use requesting user's calendar
  if (freebusyItems.length === 0 || freebusyItems.every(item => item.id === 'primary')) {
    freebusyItems.push({ id: integration?.calendarId || 'primary' });
  }

  const busyResponse = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: freebusyItems
    }
  });

  return generateAvailableSlots(
    busyResponse.data,
    startDate,
    endDate,
    durationMinutes,
    bufferBefore,
    bufferAfter
  );
}

/**
 * Delete a calendar event by ID
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  try {
    const calendar = await getCalendarClient(userId);
    const integration = await prisma.calendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'google'
        }
      }
    });

    await calendar.events.delete({
      calendarId: integration?.calendarId || 'primary',
      eventId,
      sendUpdates: 'all' // Notify attendees of cancellation
    });

    return true;
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    return false;
  }
}

/**
 * Generate available time slots from freebusy response
 */
function generateAvailableSlots(
  freebusyData: any,
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  bufferBefore: number,
  bufferAfter: number
): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  const slotDuration = durationMinutes + bufferBefore + bufferAfter;
  const current = new Date(startDate);

  while (current < endDate) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60 * 1000);
    
    // Check if slot conflicts with busy times across ALL calendars
    const conflicts = Object.values(freebusyData.calendars || {}).some((cal: any) => {
      return cal.busy?.some((busy: any) => {
        const busyStart = new Date(busy.start || '');
        const busyEnd = new Date(busy.end || '');
        return (current < busyEnd && slotEnd > busyStart);
      });
    });

    if (!conflicts) {
      slots.push({
        start: new Date(current.getTime() + bufferBefore * 60 * 1000),
        end: new Date(current.getTime() + (durationMinutes + bufferBefore) * 60 * 1000)
      });
    }

    current.setMinutes(current.getMinutes() + 30); // Check every 30 minutes
  }

  return slots;
}


