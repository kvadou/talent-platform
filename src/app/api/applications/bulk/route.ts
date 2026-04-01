import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';
import { rejectTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';
import { executeStageRules } from '@/lib/automation/stage-rules';
import { cancelApplicationInterviews } from '@/lib/interview-cancellation';
import { requireAnyRole, requireApiUser } from '@/lib/api-auth';
import { getUserMarkets } from '@/lib/market-scope';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof NextResponse) return auth;
    const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
    if (forbidden) return forbidden;

    const body = await req.json();
    const { action, applicationIds } = body;

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json({ error: 'No applications selected' }, { status: 400 });
    }

    // Filter applicationIds to only those in accessible markets
    const access = await getUserMarkets(auth.email);
    const accessibleApps = await prisma.application.findMany({
      where: {
        id: { in: applicationIds },
        ...(access.marketIds ? { job: { marketId: { in: access.marketIds } } } : {}),
      },
      select: { id: true },
    });
    const accessibleIds = accessibleApps.map((a) => a.id);

    if (accessibleIds.length === 0) {
      return NextResponse.json({ error: 'No accessible applications found' }, { status: 403 });
    }

    switch (action) {
      case 'move_stage': {
        const { stageId, skipAutomation } = body;
        if (!stageId) {
          return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 });
        }

        // Verify stage exists
        const stage = await prisma.stage.findUnique({ where: { id: stageId } });
        if (!stage) {
          return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
        }

        // Get current stages for all applications before updating
        const currentApps = await prisma.application.findMany({
          where: { id: { in: accessibleIds } },
          select: { id: true, stageId: true },
        });
        const currentStageMap = new Map(currentApps.map((app) => [app.id, app.stageId]));

        // Update all applications in a transaction
        await prisma.$transaction(async (tx) => {
          for (const applicationId of accessibleIds) {
            await tx.application.update({
              where: { id: applicationId },
              data: { stageId, updatedAt: new Date() },
            });

            await tx.stageHistory.create({
              data: {
                applicationId,
                stageId,
                movedAt: new Date(),
              },
            });
          }
        });

        // Execute automation rules for each application (unless skipped)
        if (!skipAutomation) {
          for (const applicationId of accessibleIds) {
            const oldStageId = currentStageMap.get(applicationId);

            if (oldStageId && oldStageId !== stageId) {
              await executeStageRules(applicationId, oldStageId, 'onExit').catch(console.error);
            }

            await executeStageRules(applicationId, stageId, 'onEnter').catch(console.error);
          }
        }

        return NextResponse.json({
          success: true,
          message: `Moved ${accessibleIds.length} applications to stage`,
          count: accessibleIds.length,
        });
      }

      case 'reject': {
        const { sendEmail: shouldSendEmail } = body;

        await prisma.$transaction(async (tx) => {
          await tx.application.updateMany({
            where: { id: { in: accessibleIds } },
            data: { status: 'REJECTED' },
          });

          if (shouldSendEmail) {
            const apps = await tx.application.findMany({
              where: { id: { in: accessibleIds } },
              include: { candidate: true, job: true },
            });
            for (const app of apps) {
              try {
                const mergeData = buildMergeData({
                  candidate: { firstName: app.candidate.firstName, lastName: app.candidate.lastName, email: app.candidate.email },
                  job: { title: app.job.title },
                });
                const dbTpl = await resolveTemplate('APPLICATION_REJECTION', mergeData);
                const template = dbTpl || rejectTemplate(app.candidate.firstName);
                const sendResult = await sendEmail({
                  to: app.candidate.email,
                  subject: template.subject,
                  htmlBody: template.html,
                });
                await tx.messageLog.create({
                  data: {
                    applicationId: app.id,
                    type: 'EMAIL',
                    recipient: app.candidate.email,
                    subject: template.subject,
                    body: template.html,
                    status: 'SENT',
                    postmarkMessageId: sendResult?.MessageID || null,
                  },
                });
              } catch (emailErr) {
                console.error(`Failed to send rejection email to ${app.candidate.email}:`, emailErr);
              }
            }
          }
        });

        // Cancel scheduled interviews for all rejected applications (outside transaction)
        let totalCancelledInterviews = 0;
        for (const applicationId of accessibleIds) {
          const cancelled = await cancelApplicationInterviews(applicationId).catch((err) => {
            console.error(`Failed to cancel interviews for ${applicationId}:`, err);
            return 0;
          });
          totalCancelledInterviews += cancelled;
        }

        return NextResponse.json({
          success: true,
          message: `Rejected ${accessibleIds.length} applications`,
          count: accessibleIds.length,
          cancelledInterviews: totalCancelledInterviews,
        });
      }

      case 'update_status': {
        const { status } = body;
        if (!status || !['ACTIVE', 'HIRED', 'REJECTED', 'WITHDRAWN'].includes(status)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        await prisma.application.updateMany({
          where: { id: { in: accessibleIds } },
          data: { status },
        });

        return NextResponse.json({
          success: true,
          message: `Updated ${accessibleIds.length} applications to ${status}`,
          count: accessibleIds.length,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bulk application action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
