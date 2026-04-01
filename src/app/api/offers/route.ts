import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const marketAccess = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get('applicationId');
  const status = searchParams.get('status');

  const where: any = marketAccess.marketIds === null ? {} : {
    application: {
      job: {
        marketId: { in: marketAccess.marketIds }
      }
    }
  };

  if (applicationId) where.applicationId = applicationId;
  if (status) where.status = status;

  const offers = await prisma.offer.findMany({
    where,
    include: {
      application: {
        select: {
          id: true,
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          job: {
            select: {
              id: true,
              title: true,
              market: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      },
      approvals: {
        include: {
          offer: false
        },
        orderBy: {
          createdAt: 'asc'
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ offers });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const marketAccess = await getUserMarkets(session.user.email);

  const body = await req.json();
  const {
    applicationId,
    salary,
    currency,
    equity,
    bonus,
    benefits,
    startDate,
    expiresAt,
    approvers // Array of {userId: string, role: string}
  } = body;

  if (!applicationId || !salary || !startDate || !expiresAt) {
    return NextResponse.json({
      error: 'applicationId, salary, startDate, and expiresAt are required'
    }, { status: 400 });
  }

  // Verify application exists and user has access
  const whereClause: any = { id: applicationId };
  if (marketAccess.marketIds !== null) {
    whereClause.job = {
      marketId: { in: marketAccess.marketIds }
    };
  }

  const application = await prisma.application.findFirst({
    where: whereClause,
    include: {
      job: true,
      offer: true
    }
  });

  if (!application) {
    return NextResponse.json({
      error: 'Application not found or you do not have access'
    }, { status: 404 });
  }

  if (application.offer) {
    return NextResponse.json({
      error: 'An offer already exists for this application'
    }, { status: 400 });
  }

  // Create offer with approvals
  const offer = await prisma.offer.create({
    data: {
      applicationId,
      jobId: application.jobId,
      salary,
      currency: currency || 'USD',
      equity: equity || null,
      bonus: bonus || null,
      benefits: benefits || null,
      startDate: new Date(startDate),
      expiresAt: new Date(expiresAt),
      createdBy: user.id,
      status: approvers && approvers.length > 0 ? 'PENDING_APPROVAL' : 'DRAFT',
      approvals: approvers && approvers.length > 0 ? {
        create: approvers.map((approver: any) => ({
          userId: approver.userId,
          role: approver.role,
          status: 'PENDING'
        }))
      } : undefined
    },
    include: {
      application: {
        select: {
          id: true,
          candidate: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          job: {
            select: {
              title: true
            }
          }
        }
      },
      approvals: true
    }
  });

  return NextResponse.json({ offer });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const marketAccess = await getUserMarkets(session.user.email);

  const body = await req.json();
  const { id, salary, currency, equity, bonus, benefits, startDate, expiresAt, status, declineReason } = body;

  if (!id) {
    return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 });
  }

  // Verify offer exists and user has access
  const whereClause: any = { id };
  if (marketAccess.marketIds !== null) {
    whereClause.application = {
      job: {
        marketId: { in: marketAccess.marketIds }
      }
    };
  }

  const existing = await prisma.offer.findFirst({
    where: whereClause
  });

  if (!existing) {
    return NextResponse.json({
      error: 'Offer not found or you do not have access'
    }, { status: 404 });
  }

  const updateData: any = {};
  if (salary !== undefined) updateData.salary = salary;
  if (currency) updateData.currency = currency;
  if (equity !== undefined) updateData.equity = equity;
  if (bonus !== undefined) updateData.bonus = bonus;
  if (benefits !== undefined) updateData.benefits = benefits;
  if (startDate) updateData.startDate = new Date(startDate);
  if (expiresAt) updateData.expiresAt = new Date(expiresAt);
  if (status) {
    updateData.status = status;
    if (status === 'SENT' && !existing.sentAt) {
      updateData.sentAt = new Date();
    }
    if (['ACCEPTED', 'DECLINED'].includes(status) && !existing.respondedAt) {
      updateData.respondedAt = new Date();
    }
  }
  if (declineReason !== undefined) updateData.declineReason = declineReason;

  const offer = await prisma.offer.update({
    where: { id },
    data: updateData,
    include: {
      application: {
        select: {
          id: true,
          candidate: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          job: {
            select: {
              title: true
            }
          }
        }
      },
      approvals: true
    }
  });

  return NextResponse.json({ offer });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const marketAccess = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 });
  }

  // Verify offer exists and user has access
  const whereClause: any = { id };
  if (marketAccess.marketIds !== null) {
    whereClause.application = {
      job: {
        marketId: { in: marketAccess.marketIds }
      }
    };
  }

  const existing = await prisma.offer.findFirst({
    where: whereClause
  });

  if (!existing) {
    return NextResponse.json({
      error: 'Offer not found or you do not have access'
    }, { status: 404 });
  }

  // Don't allow deletion of accepted offers
  if (existing.status === 'ACCEPTED') {
    return NextResponse.json({
      error: 'Cannot delete an accepted offer'
    }, { status: 400 });
  }

  await prisma.offer.delete({
    where: { id }
  });

  return NextResponse.json({ success: true });
}
