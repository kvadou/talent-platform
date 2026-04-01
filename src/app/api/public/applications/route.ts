import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';
import { applicationReceivedTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';
import { updateCandidateEmbedding, computeMatchScore, checkAndSendHighMatchAlert } from '@/lib/matching';
import { extractContactInfo } from '@/lib/resume-parser';
import { applicationTokenExpiresAt, generateToken, hashToken } from '@/lib/tokens';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';
import { Prisma } from '@prisma/client';
import { notifyNewApplicant } from '@/lib/new-applicant-notify';

// Detect application source from UTM params or referrer
function detectSource(req: Request): string {
  const url = new URL(req.url);

  // 1. Check UTM source param (most reliable)
  const utmSource = url.searchParams.get('utm_source')?.toLowerCase();
  if (utmSource) {
    if (utmSource.includes('indeed')) return 'INDEED';
    if (utmSource.includes('linkedin')) return 'LINKEDIN';
    if (utmSource.includes('google')) return 'GOOGLE';
    if (utmSource.includes('facebook') || utmSource.includes('meta')) return 'FACEBOOK';
    if (utmSource.includes('referral')) return 'REFERRAL';
    // Return the UTM source in uppercase if it's a known pattern
    return utmSource.toUpperCase();
  }

  // 2. Check referrer header for organic traffic
  const referrer = req.headers.get('referer') || req.headers.get('referrer');
  if (referrer) {
    try {
      const refDomain = new URL(referrer).hostname.toLowerCase();
      if (refDomain.includes('indeed.com')) return 'INDEED';
      if (refDomain.includes('linkedin.com')) return 'LINKEDIN';
      if (refDomain.includes('google.com')) return 'GOOGLE';
      if (refDomain.includes('facebook.com')) return 'FACEBOOK';
      if (refDomain.includes('glassdoor.com')) return 'GLASSDOOR';
      if (refDomain.includes('ziprecruiter.com')) return 'ZIPRECRUITER';
    } catch {
      // Invalid referrer URL, ignore
    }
  }

  // 3. Default to career page for direct applications
  return 'CAREER_PAGE';
}

export async function POST(req: Request) {
  try {
  const ip = getRequestIp(req);
  const limitResult = await rateLimit(`public-apply:${ip}`, 20, 60_000);
  if (!limitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limitResult.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter ?? 60) } }
    );
  }

  const formData = await req.formData();

  // Honeypot check — bots fill hidden fields, real users don't
  const honeypot = formData.get('website_url')?.toString();
  if (honeypot) {
    // Return success to avoid tipping off bots
    return NextResponse.json({ success: true, id: 'ok' });
  }

  const jobId = String(formData.get('jobId'));
  const email = String(formData.get('email'));
  const firstName = String(formData.get('firstName'));
  const lastName = String(formData.get('lastName'));
  const phone = formData.get('phone')?.toString();
  const coverLetter = formData.get('coverLetter')?.toString();
  const marketId = String(formData.get('marketId'));
  const resumeUrl = formData.get('resumeUrl')?.toString();
  const linkedinUrl = formData.get('linkedinUrl')?.toString();
  const answersJson = formData.get('answers')?.toString();

  // Detect source from UTM params or referrer
  const source = detectSource(req);

  if (!jobId || !email || !firstName || !lastName || !marketId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId, marketId },
    include: { questions: true }
  });
  if (!job || job.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'Job not available' }, { status: 400 });
  }

  // Validate required questions are answered
  if (answersJson && job.questions.length > 0) {
    const answers = JSON.parse(answersJson) as Record<string, string>;
    for (const question of job.questions) {
      if (question.required && !answers[question.id]) {
        return NextResponse.json({
          error: `Please answer required question: "${question.label}"`
        }, { status: 400 });
      }
    }
  }

  const defaultStage = await prisma.stage.findFirst({ where: { jobId, isDefault: true }, orderBy: { order: 'asc' } });
  if (!defaultStage) {
    return NextResponse.json({ error: 'Job missing default stage' }, { status: 400 });
  }

  // Find or create candidate by email
  let candidate = await prisma.candidate.findFirst({
    where: { email }
  });

  if (candidate) {
    candidate = await prisma.candidate.update({
      where: { id: candidate.id },
      data: { firstName, lastName, phone, coverLetter, resumeUrl, linkedinUrl }
    });
  } else {
    candidate = await prisma.candidate.create({
      data: { email, firstName, lastName, phone, coverLetter, resumeUrl, linkedinUrl }
    });
  }

  let application: Prisma.ApplicationGetPayload<{
    include: { candidate: true; job: true };
  }>;
  try {
    application = await prisma.application.create({
      data: {
        jobId,
        candidateId: candidate.id,
        stageId: defaultStage.id,
        status: 'ACTIVE',
        source
      },
      include: { candidate: true, job: true }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.application.findFirst({
        where: { jobId, candidateId: candidate.id },
        include: { candidate: true, job: true },
      });
      if (!existing) throw error;
      application = existing;
    } else {
      throw error;
    }
  }

  // Save question answers
  if (answersJson) {
    const answers = JSON.parse(answersJson) as Record<string, string>;
    const answerRecords = Object.entries(answers)
      .filter(([, value]) => value) // Skip empty answers
      .map(([questionId, value]) => ({
        applicationId: application.id,
        questionId,
        value
      }));

    if (answerRecords.length > 0) {
      await prisma.applicationAnswer.createMany({
        data: answerRecords
      });
    }
  }

  const existingStageHistory = await prisma.stageHistory.findFirst({
    where: { applicationId: application.id, stageId: defaultStage.id },
    select: { id: true },
  });
  if (!existingStageHistory) {
    await prisma.stageHistory.create({
      data: {
        applicationId: application.id,
        stageId: defaultStage.id
      }
    });
  }

  // Create portal token for candidate to check status
  const rawToken = generateToken();
  await prisma.applicationToken.create({
    data: {
      applicationId: application.id,
      token: hashToken(rawToken),
      expiresAt: applicationTokenExpiresAt(),
    },
  });

  // Generate portal URL using the raw (unhashed) token
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const portalUrl = `${baseUrl}/status/${rawToken}`;

  try {
    const mergeData = buildMergeData({
      candidate: { firstName: candidate.firstName, lastName: candidate.lastName, email: candidate.email },
      job: { title: application.job.title },
      scheduling: portalUrl ? { portalUrl } : undefined,
    });
    const dbTemplate = await resolveTemplate('APPLICATION_RECEIVED', mergeData);
    const template = dbTemplate || applicationReceivedTemplate(candidate.firstName, application.job.title, portalUrl);
    const sendResult = await sendEmail({ to: candidate.email, subject: template.subject, htmlBody: template.html });

    // Log the email to MessageLog for activity feed
    await prisma.messageLog.create({
      data: {
        applicationId: application.id,
        type: 'EMAIL',
        recipient: candidate.email,
        subject: template.subject,
        body: template.html,
        status: 'SENT',
        postmarkMessageId: sendResult?.MessageID || null,
      },
    });
  } catch (err) {
    console.error('Email send failed', err);
  }

  // Notify recruiters (email + Slack) — non-blocking
  notifyNewApplicant({
    applicationId: application.id,
    candidateName: `${candidate.firstName} ${candidate.lastName}`,
    candidateEmail: candidate.email,
    jobId,
    jobTitle: application.job.title,
    source,
    resumeUrl,
  }).catch((err) => console.error('New applicant notification failed:', err));

  // Extract resume email as secondary if different from form email (non-blocking)
  if (resumeUrl) {
    (async () => {
      try {
        const contactInfo = await extractContactInfo(resumeUrl);
        if (contactInfo.email && contactInfo.email.toLowerCase() !== email.toLowerCase()) {
          await prisma.candidate.update({
            where: { id: candidate.id },
            data: { secondaryEmail: contactInfo.email },
          });
        }
      } catch (err) {
        console.error('Resume email extraction failed:', err);
      }
    })();
  }

  // Auto-rank: Generate embedding and compute match score (non-blocking)
  (async () => {
    try {
      // Update candidate embedding (uses resume text if available)
      await updateCandidateEmbedding(candidate.id);
      // Compute match score for this job
      const { combinedScore, matchedKeywords } = await computeMatchScore(candidate.id, jobId);
      // Send alert if high match
      await checkAndSendHighMatchAlert(candidate.id, jobId, combinedScore, matchedKeywords);
    } catch (err) {
      console.error('Auto-ranking failed for candidate', candidate.id, err);
    }
  })();

  return NextResponse.json({
    message: 'Application submitted',
    applicationId: application.id,
    portalUrl
  });
  } catch (error) {
    console.error('Application submission error:', error);
    return NextResponse.json(
      { error: 'Something went wrong submitting your application. Please try again.' },
      { status: 500 }
    );
  }
}
