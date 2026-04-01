import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const POSTMARK_WEBHOOK_TOKEN = process.env.POSTMARK_WEBHOOK_TOKEN;

function verifyPostmarkAuth(req: Request): boolean {
  if (!POSTMARK_WEBHOOK_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Postmark Webhook] POSTMARK_WEBHOOK_TOKEN not configured in production — rejecting');
      return false;
    }
    console.warn('[Postmark Webhook] No webhook token configured, skipping verification in dev');
    return true;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;

  const expected = `Bearer ${POSTMARK_WEBHOOK_TOKEN}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!verifyPostmarkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Postmark sends different event types
    const { RecordType, MessageID, ReceivedAt } = body;

    if (!MessageID) {
      return NextResponse.json({ error: 'MessageID is required' }, { status: 400 });
    }

    // Find the message log by Postmark message ID
    const messageLog = await prisma.messageLog.findUnique({
      where: { postmarkMessageId: MessageID }
    });

    if (!messageLog) {
      // Message not found - this is okay, might be from a different system
      return NextResponse.json({ message: 'Message not tracked' }, { status: 200 });
    }

    // Update based on event type
    const updateData: Record<string, unknown> = {};

    switch (RecordType) {
      case 'Open':
        if (!messageLog.openedAt) {
          updateData.openedAt = new Date(ReceivedAt || Date.now());
        }
        break;

      case 'Click':
        if (!messageLog.clickedAt) {
          updateData.clickedAt = new Date(ReceivedAt || Date.now());
        }
        break;

      case 'Bounce':
        updateData.status = 'BOUNCED';
        updateData.bouncedAt = new Date(ReceivedAt || Date.now());
        updateData.errorMessage = body.Description || body.Details || 'Email bounced';
        break;

      case 'SpamComplaint':
        updateData.status = 'BOUNCED';
        updateData.bouncedAt = new Date(ReceivedAt || Date.now());
        updateData.errorMessage = 'Spam complaint';
        break;

      case 'Delivery':
        break;

      default:
        console.log('Unknown Postmark event type:', RecordType);
    }

    // Update the message log if there are changes
    if (Object.keys(updateData).length > 0) {
      await prisma.messageLog.update({
        where: { id: messageLog.id },
        data: updateData
      });
    }

    return NextResponse.json({ message: 'Webhook processed', type: RecordType });
  } catch (error) {
    console.error('Postmark webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
