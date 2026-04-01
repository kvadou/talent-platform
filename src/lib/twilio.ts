import twilio from 'twilio';

// Twilio client singleton
let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/**
 * Send an SMS message
 */
export async function sendSMS(to: string, message: string): Promise<{ sid: string; success: boolean }> {
  if (!isTwilioConfigured()) {
    console.log(`[Twilio Stub] Would send SMS to ${to}: "${message.slice(0, 50)}..." — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to send real SMS`);
    return { sid: 'mock-sms-sid', success: true };
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

  // Normalize phone number (ensure it has +1 for US)
  const normalizedTo = normalizePhoneNumber(to);

  try {
    const client = getTwilioClient();
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: normalizedTo,
    });

    console.log(`[Twilio] SMS sent: ${result.sid}`);
    return { sid: result.sid, success: true };
  } catch (error) {
    console.error('[Twilio] Failed to send SMS:', error);
    throw error;
  }
}

/**
 * Validate incoming Twilio webhook signature
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[Twilio] Missing auth token for signature validation');
    return false;
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Generate TwiML response for SMS
 */
export function generateTwiMLResponse(message?: string): string {
  const response = new twilio.twiml.MessagingResponse();
  if (message) {
    response.message(message);
  }
  return response.toString();
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it already has country code, just add +
  if (digits.length > 10) {
    return `+${digits}`;
  }

  // Return as-is with + if nothing matched
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
