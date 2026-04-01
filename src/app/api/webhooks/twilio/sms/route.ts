import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateTwilioSignature, generateTwiMLResponse, sendSMS, normalizePhoneNumber } from '@/lib/twilio';
import { processScreeningResponse, generateFirstQuestion } from '@/lib/screening-conversation';

/**
 * Twilio SMS Webhook
 * Receives incoming SMS messages and routes them to active screening sessions
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('[Twilio Webhook] Received inbound SMS');

    // Validate signature in production
    if (process.env.NODE_ENV === 'production') {
      const signature = request.headers.get('x-twilio-signature') || '';
      const url = request.url;

      if (!validateTwilioSignature(signature, url, params)) {
        console.error('[Twilio Webhook] Invalid signature');
        return new NextResponse(generateTwiMLResponse(), {
          status: 403,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    }

    const fromPhone = normalizePhoneNumber(params.From || '');
    const messageBody = params.Body?.trim() || '';

    if (!fromPhone || !messageBody) {
      console.error('[Twilio Webhook] Missing From or Body');
      return new NextResponse(generateTwiMLResponse(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Find active screening session for this phone number
    const session = await prisma.aIScreeningSession.findFirst({
      where: {
        candidatePhone: fromPhone,
        status: { in: ['IN_PROGRESS', 'AWAITING_RESPONSE'] },
        type: 'TEXT_SMS',
      },
      include: {
        application: {
          include: {
            candidate: { select: { firstName: true, lastName: true } },
            job: { select: { id: true, title: true } },
          },
        },
        questionSet: {
          include: {
            questions: { orderBy: { order: 'asc' } },
          },
        },
        messages: { orderBy: { sentAt: 'asc' } },
      },
    });

    if (!session) {
      console.log('[Twilio Webhook] No active screening session');
      // Return empty TwiML - don't respond to unknown numbers
      return new NextResponse(generateTwiMLResponse(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Create message record for candidate response
    const candidateMessage = await prisma.screeningMessage.create({
      data: {
        sessionId: session.id,
        role: 'CANDIDATE',
        content: messageBody,
      },
    });

    // Update session activity
    await prisma.aIScreeningSession.update({
      where: { id: session.id },
      data: {
        status: 'IN_PROGRESS',
        lastActivityAt: new Date(),
      },
    });

    // Transform session for processing
    const sessionForProcessing = {
      id: session.id,
      status: session.status,
      application: {
        candidate: {
          firstName: session.application.candidate.firstName,
          lastName: session.application.candidate.lastName,
        },
        job: {
          id: session.application.job.id,
          title: session.application.job.title,
        },
      },
      questionSet: session.questionSet
        ? {
            questions: session.questionSet.questions.map((q) => ({
              id: q.id,
              order: q.order,
              question: q.question,
              questionType: q.questionType,
              options: q.options,
              isKnockout: q.isKnockout,
              knockoutAnswer: q.knockoutAnswer,
              knockoutMessage: q.knockoutMessage,
              evaluationPrompt: q.evaluationPrompt,
              minAcceptableScore: q.minAcceptableScore,
            })),
          }
        : null,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        questionId: m.questionId,
        questionOrder: m.questionOrder,
        aiScore: m.aiScore,
      })),
    };

    // Process through AI
    const result = await processScreeningResponse(
      sessionForProcessing,
      messageBody,
      candidateMessage.id
    );

    // Send AI response via SMS (async, don't block webhook response)
    sendSMS(fromPhone, result.aiMessage.content).catch((err) => {
      console.error('[Twilio Webhook] Failed to send response SMS:', err);
    });

    // Return empty TwiML (we send response separately for better control)
    return new NextResponse(generateTwiMLResponse(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[Twilio Webhook] Error:', error);
    return new NextResponse(generateTwiMLResponse(), {
      status: 500,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

// Handle GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'ok', webhook: 'twilio-sms' });
}
