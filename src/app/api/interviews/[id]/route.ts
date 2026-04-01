import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { format } from 'date-fns';
import { getRecordingStreamUrl, getResumeDownloadUrl } from '@/lib/s3';

// GET - Fetch single interview with full Interview Kit data
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Get current user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  // Get full interview details for the Interview Kit
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      interviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      scorecard: true,
      feedback: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      // Interview Kit recording and AI data
      recording: {
        include: {
          transcript: true,
        },
      },
      aiSummary: true,
      kitScorecards: {
        include: {
          scorer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          ratings: {
            include: {
              attribute: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      application: {
        include: {
          candidate: {
            include: {
              candidateNotes: {
                orderBy: { createdAt: 'desc' },
                include: {
                  author: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          job: {
            include: {
              stages: {
                orderBy: { order: 'asc' },
              },
              interviewKits: {
                include: {
                  stage: true,
                  prepItems: {
                    orderBy: { order: 'asc' },
                  },
                  categories: {
                    orderBy: { order: 'asc' },
                    include: {
                      attributes: {
                        orderBy: { order: 'asc' },
                      },
                    },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
          stage: true,
        },
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  const userFeedback = user
    ? interview.feedback.find((f) => f.userId === user.id)
    : null;

  // Format response for Interview Kit
  const response = {
    id: interview.id,
    applicationId: interview.applicationId,
    scheduledAt: interview.scheduledAt,
    duration: interview.duration,
    type: interview.type,
    location: interview.location,
    meetingLink: interview.meetingLink,
    notes: interview.notes,
    interviewer: {
      id: interview.interviewer.id,
      name: `${interview.interviewer.firstName} ${interview.interviewer.lastName}`.trim(),
      email: interview.interviewer.email,
    },
    candidate: {
      id: interview.application.candidate.id,
      firstName: interview.application.candidate.firstName,
      lastName: interview.application.candidate.lastName,
      name: `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`.trim(),
      email: interview.application.candidate.email,
      phone: interview.application.candidate.phone,
      linkedinUrl: interview.application.candidate.linkedinUrl,
      resumeUrl: interview.application.candidate.resumeUrl
        ? await getResumeDownloadUrl(interview.application.candidate.resumeUrl)
        : null,
      notes: interview.application.candidate.candidateNotes,
    },
    job: {
      id: interview.application.job.id,
      title: interview.application.job.title,
      location: interview.application.job.location,
      description: interview.application.job.description,
      stages: interview.application.job.stages,
    },
    application: {
      id: interview.application.id,
      status: interview.application.status,
      source: interview.application.source,
      createdAt: interview.application.createdAt,
    },
    stage: interview.application.stage,
    scorecard: interview.scorecard
      ? {
          id: interview.scorecard.id,
          name: interview.scorecard.name,
          description: interview.scorecard.description,
          criteria: interview.scorecard.criteria,
        }
      : null,
    feedback: interview.feedback.map((f) => ({
      id: f.id,
      userId: f.userId,
      userName: `${f.user.firstName} ${f.user.lastName}`.trim(),
      scores: f.scores,
      recommendation: f.recommendation,
      strengths: f.strengths,
      weaknesses: f.weaknesses,
      notes: f.notes,
      submittedAt: f.submittedAt,
    })),
    userFeedback: userFeedback
      ? {
          id: userFeedback.id,
          scores: userFeedback.scores,
          recommendation: userFeedback.recommendation,
          strengths: userFeedback.strengths,
          weaknesses: userFeedback.weaknesses,
          notes: userFeedback.notes,
          submittedAt: userFeedback.submittedAt,
        }
      : null,
    hasFeedback: !!userFeedback,
    // Interview Kit data - generate signed URLs for recording playback
    recording: interview.recording
      ? await (async () => {
          let signedVideoUrl: string | null = null;
          let signedAudioUrl: string | null = null;

          // Generate signed URLs for S3 files
          if (interview.recording!.videoUrl) {
            const videoKey = extractS3Key(interview.recording!.videoUrl);
            if (videoKey) {
              signedVideoUrl = await getRecordingStreamUrl(videoKey, 3600);
            }
          }
          if (interview.recording!.audioUrl) {
            const audioKey = extractS3Key(interview.recording!.audioUrl);
            if (audioKey) {
              signedAudioUrl = await getRecordingStreamUrl(audioKey, 3600);
            }
          }

          return {
            id: interview.recording!.id,
            videoUrl: signedVideoUrl || interview.recording!.videoUrl,
            audioUrl: signedAudioUrl || interview.recording!.audioUrl,
            duration: interview.recording!.duration,
            status: interview.recording!.status,
            recordedAt: interview.recording!.recordedAt,
            transcript: interview.recording!.transcript
              ? {
                  id: interview.recording!.transcript.id,
                  fullText: interview.recording!.transcript.fullText,
                  segments: interview.recording!.transcript.segments,
                }
              : null,
          };
        })()
      : null,
    aiSummary: interview.aiSummary
      ? {
          id: interview.aiSummary.id,
          summary: interview.aiSummary.summary,
          attributeAnalysis: interview.aiSummary.attributeAnalysis,
          recommendation: interview.aiSummary.recommendation,
          recommendationScore: interview.aiSummary.recommendationScore,
          recommendationReason: interview.aiSummary.recommendationReason,
          strengths: interview.aiSummary.strengths,
          concerns: interview.aiSummary.concerns,
          followUpQuestions: interview.aiSummary.followUpQuestions,
        }
      : null,
    kitScorecards: interview.kitScorecards.map((sc) => ({
      id: sc.id,
      scorerId: sc.scorerId,
      scorerName: `${sc.scorer.firstName} ${sc.scorer.lastName}`.trim(),
      keyTakeaways: sc.keyTakeaways,
      privateNotes: user && sc.scorerId === user.id ? sc.privateNotes : null,
      overallRecommendation: sc.overallRecommendation,
      submittedAt: sc.submittedAt,
      ratings: sc.ratings.map((r) => ({
        id: r.id,
        attributeId: r.attributeId,
        attributeName: r.attribute.name,
        rating: r.rating,
        notes: r.notes,
        aiSuggested: r.aiSuggested,
      })),
    })),
    interviewKits: interview.application.job.interviewKits,
    // Find the matching interview kit for this interview type/stage
    matchingKit: interview.application.job.interviewKits.find(
      (kit) => kit.type === interview.type || kit.stageId === interview.application.stageId
    ) || null,
  };

  return NextResponse.json(response);
}

// PATCH - Reschedule interview
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureUser();

  const { id } = await params;
  const body = await req.json();
  const { scheduledAt, duration, location, meetingLink, notes } = body;

  const existing = await prisma.interview.findUnique({
    where: { id },
    include: {
      interviewer: true,
      application: {
        include: {
          candidate: true,
          job: true
        }
      }
    }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  const interview = await prisma.interview.update({
    where: { id },
    data: {
      ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(meetingLink !== undefined ? { meetingLink } : {}),
      ...(notes !== undefined ? { notes } : {}),
      // If rescheduling, reset confirmation sent flag
      ...(scheduledAt ? { confirmationSent: false, reminderSent: false } : {})
    },
    include: {
      interviewer: true,
      application: {
        include: {
          candidate: true,
          job: true
        }
      }
    }
  });

  // Log the reschedule in message log
  if (scheduledAt) {
    const oldTime = format(existing.scheduledAt, "MMMM d, yyyy 'at' h:mm a");
    const newTime = format(new Date(scheduledAt), "MMMM d, yyyy 'at' h:mm a");

    await prisma.messageLog.create({
      data: {
        applicationId: interview.applicationId,
        type: 'EMAIL',
        recipient: interview.application.candidate.email,
        subject: `Interview Rescheduled: ${interview.application.job.title}`,
        body: `Your interview has been rescheduled from ${oldTime} to ${newTime}.`,
        status: 'SENT'
      }
    });
  }

  return NextResponse.json({ interview });
}

// DELETE - Cancel interview
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureUser();

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const reason = searchParams.get('reason') || 'Interview cancelled';

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      interviewer: true,
      application: {
        include: {
          candidate: true,
          job: true
        }
      }
    }
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  // Log the cancellation
  await prisma.messageLog.create({
    data: {
      applicationId: interview.applicationId,
      type: 'EMAIL',
      recipient: interview.application.candidate.email,
      subject: `Interview Cancelled: ${interview.application.job.title}`,
      body: `Your interview scheduled for ${interview.scheduledAt.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })} has been cancelled. Reason: ${reason}`,
      status: 'SENT'
    }
  });

  // Delete the interview
  await prisma.interview.delete({
    where: { id }
  });

  return NextResponse.json({ success: true });
}

/**
 * Extract S3 key from a full S3 URL
 */
function extractS3Key(url: string): string | null {
  try {
    // Handle both S3 URLs and direct keys
    if (url.startsWith('recordings/')) {
      return url;
    }

    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.slice(1);
  } catch {
    return null;
  }
}
