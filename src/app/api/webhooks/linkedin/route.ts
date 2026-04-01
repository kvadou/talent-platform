import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeStageRules } from '@/lib/automation/stage-rules';
import { updateCandidateEmbedding, computeMatchScore, checkAndSendHighMatchAlert } from '@/lib/matching';
import crypto from 'crypto';
import { applicationTokenExpiresAt, generateToken, hashToken } from '@/lib/tokens';

// LinkedIn webhook secret for signature verification
const LINKEDIN_WEBHOOK_SECRET = process.env.LINKEDIN_WEBHOOK_SECRET || '';

/**
 * Verify LinkedIn webhook signature
 */
function verifySignature(body: string, signature: string): boolean {
  if (!LINKEDIN_WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('LINKEDIN_WEBHOOK_SECRET not configured in production — rejecting');
      return false;
    }
    console.warn('LINKEDIN_WEBHOOK_SECRET not configured - skipping signature verification in dev');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', LINKEDIN_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * LinkedIn Easy Apply Webhook Handler
 *
 * Receives application data from LinkedIn when candidates apply through Easy Apply.
 * Maps the LinkedIn data to our Candidate/Application models.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-linkedin-signature') || '';

    // Verify webhook signature
    if (!verifySignature(rawBody, signature)) {
      console.error('LinkedIn webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // LinkedIn Easy Apply payload structure (simplified)
    const {
      job_posting_id,     // LinkedIn job posting ID
      application_id,     // LinkedIn application ID
      applicant,          // Applicant details
      resume_url,         // URL to resume (if provided)
      applied_at,         // Timestamp
      answers,            // Answers to screening questions
    } = body;

    if (!job_posting_id || !application_id || !applicant) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find our job by LinkedIn job ID
    const job = await prisma.job.findUnique({
      where: { linkedinJobId: job_posting_id },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          take: 1
        }
      }
    });

    if (!job) {
      console.warn(`LinkedIn job not found: ${job_posting_id}`);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const firstStage = job.stages[0];
    if (!firstStage) {
      return NextResponse.json({ error: 'Job has no stages configured' }, { status: 400 });
    }

    // Check if application already exists (idempotency)
    const existingApplication = await prisma.application.findUnique({
      where: { linkedinApplicationId: application_id }
    });

    if (existingApplication) {
      return NextResponse.json({
        message: 'Application already processed',
        applicationId: existingApplication.id
      });
    }

    // Extract applicant details from LinkedIn payload
    const {
      first_name,
      last_name,
      email,
      phone,
      linkedin_profile_url,
      location
    } = applicant;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find or create candidate
    let candidate = await prisma.candidate.findFirst({
      where: { email: email.toLowerCase() }
    });

    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          firstName: first_name || 'Unknown',
          lastName: last_name || '',
          email: email.toLowerCase(),
          phone: phone || null,
          linkedinUrl: linkedin_profile_url || null,
          city: location?.city || null,
          state: location?.state || null,
          country: location?.country || null,
          resumeUrl: resume_url || null,
          source: 'LINKEDIN', // CandidateSource enum
          sourceDetails: 'LinkedIn Easy Apply',
          tags: ['linkedin-easy-apply']
        }
      });
    } else {
      // Update candidate with any new info from LinkedIn
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          linkedinUrl: linkedin_profile_url || candidate.linkedinUrl,
          phone: phone || candidate.phone,
          resumeUrl: resume_url || candidate.resumeUrl,
          tags: candidate.tags.includes('linkedin-easy-apply')
            ? candidate.tags
            : [...candidate.tags, 'linkedin-easy-apply']
        }
      });
    }

    // Create the application
    const application = await prisma.application.create({
      data: {
        jobId: job.id,
        candidateId: candidate.id,
        stageId: firstStage.id,
        status: 'ACTIVE',
        source: 'LINKEDIN',
        linkedinApplicationId: application_id
      }
    });

    // Create stage history for initial stage
    await prisma.stageHistory.create({
      data: {
        applicationId: application.id,
        stageId: firstStage.id
      }
    });

    // Store answers to screening questions if provided
    if (answers && Array.isArray(answers)) {
      for (const answer of answers) {
        // LinkedIn provides question_id which we'd need to map to our JobQuestion IDs
        // This is a simplified version - you'd need to implement question mapping
        if (answer.question_id && answer.value) {
          // Try to find matching question by some identifier
          const question = await prisma.jobQuestion.findFirst({
            where: {
              jobId: job.id,
              label: { contains: answer.question_text || '' }
            }
          });

          if (question) {
            await prisma.applicationAnswer.create({
              data: {
                applicationId: application.id,
                questionId: question.id,
                value: String(answer.value)
              }
            });
          }
        }
      }
    }

    // Create application portal token for candidate access (store hash, raw token used via stage rules emails)
    const rawToken = generateToken();
    await prisma.applicationToken.create({
      data: {
        applicationId: application.id,
        token: hashToken(rawToken),
        expiresAt: applicationTokenExpiresAt(),
      }
    });

    // Execute stage automation rules (e.g., send confirmation email)
    await executeStageRules(application.id, firstStage.id, 'onEnter').catch(console.error);

    // Auto-rank: Generate embedding and compute match score (non-blocking)
    (async () => {
      try {
        await updateCandidateEmbedding(candidate.id);
        const { combinedScore, matchedKeywords } = await computeMatchScore(candidate.id, job.id);
        await checkAndSendHighMatchAlert(candidate.id, job.id, combinedScore, matchedKeywords);
      } catch (err) {
        console.error('Auto-ranking failed for LinkedIn candidate', candidate.id, err);
      }
    })();

    console.log(`LinkedIn application created: ${application.id} for job ${job.id}`);

    return NextResponse.json({
      success: true,
      message: 'Application created',
      applicationId: application.id,
      candidateId: candidate.id
    });

  } catch (error) {
    console.error('LinkedIn webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * LinkedIn sends a GET request to verify the webhook URL
 */
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('challenge');

  if (challenge) {
    // Return the challenge value for webhook verification
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return NextResponse.json({ status: 'LinkedIn webhook endpoint active' });
}
