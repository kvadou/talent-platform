import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      candidateNotes: {
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      applications: {
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              market: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          stage: {
            select: {
              id: true,
              name: true,
              order: true
            }
          },
          stageHistory: {
            include: {
              stage: true
            },
            orderBy: {
              movedAt: 'desc'
            },
            take: 10
          },
          interviews: {
            include: {
              interviewer: true
            },
            orderBy: {
              scheduledAt: 'desc'
            }
          },
          notes: {
            include: {
              author: true
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 10
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      }
    }
  });
  
  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }
  
  // Filter applications by market access
  if (access.marketIds && access.marketIds.length > 0) {
    candidate.applications = candidate.applications.filter(
      app => access.marketIds!.includes(app.job.market.id)
    );
  }
  
  return NextResponse.json({ candidate });
}

// PATCH handler for updating candidate (email swap, etc.)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();

  const body = await req.json();

  if (body.action === 'swap-emails') {
    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      select: { email: true, secondaryEmail: true },
    });
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    if (!candidate.secondaryEmail) return NextResponse.json({ error: 'No secondary email to swap' }, { status: 400 });

    const updated = await prisma.candidate.update({
      where: { id: params.id },
      data: {
        email: candidate.secondaryEmail,
        secondaryEmail: candidate.email,
      },
    });
    return NextResponse.json({ candidate: updated });
  }

  if (body.action === 'update-fields') {
    const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'timezone'] as const;
    const data: Record<string, string | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field] || null;
      }
    }
    if (data.firstName === null) delete data.firstName;
    if (data.email === null) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.candidate.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ candidate: updated });
  }

  if (body.action === 'update-timezone') {
    const { timezone } = body;
    if (timezone !== undefined && timezone !== null && typeof timezone !== 'string') {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
    }
    const updated = await prisma.candidate.update({
      where: { id: params.id },
      data: { timezone: timezone || null },
    });
    return NextResponse.json({ candidate: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// DELETE handler for permanently deleting a candidate and all related data
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await ensureUser();
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Only HQ_ADMIN can delete candidates
  if (dbUser.role !== 'HQ_ADMIN') {
    return NextResponse.json({ error: 'Only HQ admins can delete candidates' }, { status: 403 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  // Get all application IDs for this candidate
  const applications = await prisma.application.findMany({
    where: { candidateId: params.id },
    select: { id: true },
  });
  const appIds = applications.map((a) => a.id);

  await prisma.$transaction(async (tx) => {
    // Clear references without onDelete: Cascade
    await tx.jobCandidateMatch.deleteMany({ where: { candidateId: params.id } });
    await tx.agencyCandidate.deleteMany({ where: { candidateId: params.id } });

    if (appIds.length > 0) {
      // Null out JobOpening.hiredApplicationId (no cascade)
      await tx.jobOpening.updateMany({
        where: { hiredApplicationId: { in: appIds } },
        data: { hiredApplicationId: null },
      });

      // Delete applications (cascades to interviews, notes, scorecards, etc.)
      await tx.application.deleteMany({ where: { candidateId: params.id } });
    }

    // Delete candidate (cascades to candidateNotes, activityLogs, backgroundChecks)
    await tx.candidate.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ success: true });
}

// POST handler for creating candidate notes
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await ensureUser();
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { content, isPrivate } = await req.json();

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
  }

  const note = await prisma.candidateNote.create({
    data: {
      candidateId: params.id,
      authorId: dbUser.id,
      content: content.trim(),
      isPrivate: Boolean(isPrivate)
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    }
  });
  return NextResponse.json({ note });
}

