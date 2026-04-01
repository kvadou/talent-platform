import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ApplicationDetailPage } from '@/components/applications/detail/ApplicationDetailPage';

async function getApplicationData(id: string) {
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          esignTemplateId: true,
          market: { select: { id: true, name: true } },
          stages: {
            select: {
              id: true,
              name: true,
              order: true,
              stageRules: {
                select: {
                  id: true,
                  trigger: true,
                  actionType: true,
                  isActive: true,
                },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      },
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          resumeUrl: true,
          linkedinUrl: true,
          portfolioUrl: true,
          street: true,
          city: true,
          state: true,
          country: true,
          postcode: true,
          timezone: true,
          tags: true,
          applications: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              job: {
                select: {
                  id: true,
                  title: true,
                  market: { select: { name: true } },
                },
              },
              stage: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      stage: {
        select: {
          id: true,
          name: true,
          order: true,
        },
      },
      stageHistory: {
        select: {
          id: true,
          stageId: true,
          movedAt: true,
          movedBy: true,
          stage: {
            select: {
              id: true,
              name: true,
              order: true,
            },
          },
        },
        orderBy: { movedAt: 'desc' },
      },
      interviews: {
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          type: true,
          location: true,
          meetingLink: true,
          notes: true,
          interviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          feedback: {
            select: {
              id: true,
              recommendation: true,
              strengths: true,
              weaknesses: true,
              notes: true,
              submittedAt: true,
            },
          },
          kitScorecards: {
            select: {
              id: true,
              overallRecommendation: true,
              submittedAt: true,
            },
          },
        },
        orderBy: { scheduledAt: 'desc' },
      },
      notes: {
        select: {
          id: true,
          content: true,
          isPrivate: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      tasks: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          completedAt: true,
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      },
      offer: {
        select: {
          id: true,
          compensationType: true,
          hourlyRate: true,
          salary: true,
          salaryFrequency: true,
          currency: true,
          signOnBonus: true,
          employmentType: true,
          startDate: true,
          expiresAt: true,
          status: true,
          version: true,
        },
      },
      answers: {
        select: {
          id: true,
          value: true,
          question: {
            select: {
              id: true,
              label: true,
              type: true,
            },
          },
        },
      },
      // Note: aiScore, aiScoreBreakdown, aiScoredAt are scalar fields on Application
      // They are automatically included when using 'include' at the top level
      messages: {
        select: {
          id: true,
          type: true,
          recipient: true,
          subject: true,
          body: true,
          sentAt: true,
          status: true,
        },
        orderBy: { sentAt: 'desc' },
      },
    },
  });

  if (!application) return null;

  // Get navigation info - all applications for this job in pipeline order
  const allApplications = await prisma.application.findMany({
    where: { jobId: application.job.id },
    select: { id: true },
    orderBy: [
      { stage: { order: 'asc' } },
      { createdAt: 'desc' },
    ],
  });

  const currentIndex = allApplications.findIndex((a) => a.id === id);
  const prevApplication = currentIndex > 0 ? allApplications[currentIndex - 1] : null;
  const nextApplication =
    currentIndex < allApplications.length - 1 ? allApplications[currentIndex + 1] : null;

  return {
    application,
    totalCandidates: allApplications.length,
    currentIndex: currentIndex + 1,
    prevApplicationId: prevApplication?.id || null,
    nextApplicationId: nextApplication?.id || null,
  };
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getApplicationData(id);

  if (!data) return notFound();

  const { application, totalCandidates, currentIndex, prevApplicationId, nextApplicationId } = data;

  // Transform dates to ISO strings for client component
  const transformedApplication = {
    id: application.id,
    status: application.status,
    source: application.source,
    createdAt: application.createdAt.toISOString(),
    job: {
      id: application.job.id,
      title: application.job.title,
      market: application.job.market,
      esignTemplateId: application.job.esignTemplateId,
      stages: application.job.stages,
    },
    candidate: {
      ...application.candidate,
      applications: application.candidate.applications.map((app) => ({
        ...app,
        createdAt: app.createdAt.toISOString(),
      })),
    },
    stage: application.stage,
    stageHistory: application.stageHistory.map((h) => ({
      ...h,
      movedAt: h.movedAt.toISOString(),
    })),
    interviews: application.interviews.map((i) => ({
      ...i,
      scheduledAt: i.scheduledAt.toISOString(),
      feedback: i.feedback.map((f) => ({
        id: f.id,
        recommendation: f.recommendation as string | null,
        strengths: f.strengths,
        weaknesses: f.weaknesses,
        notes: f.notes,
        submittedAt: f.submittedAt?.toISOString() || null,
      })),
      kitScorecards: i.kitScorecards.map((s) => ({
        id: s.id,
        overallRecommendation: s.overallRecommendation,
        submittedAt: s.submittedAt?.toISOString() || null,
      })),
    })),
    notes: application.notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    tasks: application.tasks.map((t) => ({
      ...t,
      dueAt: t.dueAt?.toISOString() || null,
      completedAt: t.completedAt?.toISOString() || null,
    })),
    offer: application.offer
      ? {
          ...application.offer,
          hourlyRate: application.offer.hourlyRate
            ? Number(application.offer.hourlyRate)
            : null,
          salary: application.offer.salary
            ? Number(application.offer.salary)
            : null,
          signOnBonus: application.offer.signOnBonus
            ? Number(application.offer.signOnBonus)
            : null,
          startDate: application.offer.startDate?.toISOString() || null,
          expiresAt: application.offer.expiresAt?.toISOString() || null,
        }
      : null,
    answers: application.answers,
    portalTokens: [],
    aiScore: application.aiScore,
    aiScoreBreakdown: application.aiScoreBreakdown as {
      resumeFit: number;
      answerCompleteness: number;
      answerQuality: number;
      overallScore: number;
      factors?: {
        hasResume: boolean;
        totalQuestions: number;
        answeredQuestions: number;
        avgAnswerLength: number;
      };
    } | null,
    aiScoredAt: application.aiScoredAt?.toISOString() || null,
    messages: application.messages.map((m) => ({
      ...m,
      sentAt: m.sentAt.toISOString(),
    })),
  };

  return (
    <ApplicationDetailPage
      application={transformedApplication}
      totalCandidates={totalCandidates}
      currentIndex={currentIndex}
      prevApplicationId={prevApplicationId}
      nextApplicationId={nextApplicationId}
    />
  );
}
