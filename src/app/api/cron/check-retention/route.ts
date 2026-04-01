import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBrandedEmail } from '@/lib/postmark';
import crypto from 'crypto';

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await checkRetentionCheckpoints();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error checking retention:', error);
    return NextResponse.json({ error: 'Failed to check retention' }, { status: 500 });
  }
}

async function sendRetentionEmail(
  outcome: {
    applicationId: string;
    application: {
      candidate: { firstName: string; lastName: string };
      job: { title: string; marketId: string };
    };
  },
  checkpoint: '30-day' | '90-day' | '180-day'
) {
  // Find market admins for this job's market
  const marketAdmins = await prisma.user.findMany({
    where: {
      role: { in: ['HQ_ADMIN', 'MARKET_ADMIN'] },
      marketAccess: { some: { marketId: outcome.application.job.marketId } },
    },
    select: { email: true, firstName: true },
    take: 3,
  });

  if (marketAdmins.length === 0) {
    // Fallback: find any HQ_ADMIN
    const hqAdmins = await prisma.user.findMany({
      where: { role: 'HQ_ADMIN' },
      select: { email: true, firstName: true },
      take: 1,
    });
    if (hqAdmins.length > 0) marketAdmins.push(...hqAdmins);
  }

  const candidateName = `${outcome.application.candidate.firstName} ${outcome.application.candidate.lastName}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';
  const link = `${appUrl}/applications/${outcome.applicationId}`;

  for (const admin of marketAdmins) {
    try {
      await sendBrandedEmail({
        to: admin.email,
        subject: `${checkpoint} Retention Check: ${candidateName}`,
        htmlBody: `
          <h2 style="margin: 0 0 16px 0; font-size: 18px;">${checkpoint} Retention Check</h2>
          <p>It's time for a retention check-in for <strong>${candidateName}</strong> (${outcome.application.job.title}).</p>
          <p>Please update their employment status to help us track hiring quality.</p>
          <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
            <tr>
              <td style="background-color: #6b46c1; border-radius: 6px; padding: 12px 24px;">
                <a href="${link}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">Update Retention Status</a>
              </td>
            </tr>
          </table>
          <p style="font-size: 14px; color: #718096;">This is an automated reminder from the STC ATS retention tracking system.</p>
        `,
        from: 'RECRUITING',
        preheader: `${checkpoint} check-in for ${candidateName}`,
      });
    } catch (err) {
      console.error(`Failed to send retention email to ${admin.email}:`, err);
    }
  }
}

async function checkRetentionCheckpoints(): Promise<{
  checked30: number;
  checked90: number;
  checked180: number;
  emailsSent: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  let emailsSent = 0;

  // 30-day checks: startDate 30+ days ago, stillEmployedAt30Days not yet recorded, not terminated
  const due30 = await prisma.hiringOutcome.findMany({
    where: {
      wasHired: true,
      startDate: { lte: thirtyDaysAgo },
      stillEmployedAt30Days: null,
      terminatedAt: null,
    },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true, marketId: true } },
        },
      },
    },
  });

  for (const outcome of due30) {
    await sendRetentionEmail(outcome, '30-day');
    emailsSent++;
  }

  // 90-day checks: startDate 90+ days ago, 30-day already recorded, 90-day not yet, not terminated
  const due90 = await prisma.hiringOutcome.findMany({
    where: {
      wasHired: true,
      startDate: { lte: ninetyDaysAgo },
      stillEmployedAt30Days: { not: null },
      stillEmployedAt90Days: null,
      terminatedAt: null,
    },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true, marketId: true } },
        },
      },
    },
  });

  for (const outcome of due90) {
    await sendRetentionEmail(outcome, '90-day');
    emailsSent++;
  }

  // 180-day checks: startDate 180+ days ago, 90-day already recorded, 180-day not yet, not terminated
  const due180 = await prisma.hiringOutcome.findMany({
    where: {
      wasHired: true,
      startDate: { lte: oneEightyDaysAgo },
      stillEmployedAt90Days: { not: null },
      stillEmployedAt180Days: null,
      terminatedAt: null,
    },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true, marketId: true } },
        },
      },
    },
  });

  for (const outcome of due180) {
    await sendRetentionEmail(outcome, '180-day');
    emailsSent++;
  }

  return {
    checked30: due30.length,
    checked90: due90.length,
    checked180: due180.length,
    emailsSent,
  };
}
