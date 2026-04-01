import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessApplication } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await params;
    if (!(await canAccessApplication(session.user.email, applicationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
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

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Transform data for the client
    const transformedApplication = {
      id: application.id,
      status: application.status,
      source: application.source,
      createdAt: application.createdAt.toISOString(),
      job: {
        id: application.job.id,
        title: application.job.title,
        market: application.job.market,
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
          ...f,
          submittedAt: f.submittedAt?.toISOString() || null,
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
      messages: application.messages.map((m) => ({
        ...m,
        sentAt: m.sentAt.toISOString(),
      })),
    };

    return NextResponse.json({ application: transformedApplication });
  } catch (error) {
    console.error('Failed to fetch application detail:', error);
    return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 });
  }
}
