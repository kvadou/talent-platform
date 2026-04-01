import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeStageRules } from '@/lib/automation/stage-rules';
import { ActivityLogger } from '@/lib/activity-logger';
import { canAccessApplication, requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof NextResponse) return auth;
    const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
    if (forbidden) return forbidden;

    const { id: applicationId } = await params;

    if (!(await canAccessApplication(auth.email, applicationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { stageId, skipAutomation } = await req.json();

    if (!stageId) {
      return NextResponse.json({ error: 'stageId required' }, { status: 400 });
    }

    // Get current application state
    const currentApp = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        stageId: true,
        jobId: true,
        candidateId: true,
        stage: { select: { name: true } },
        candidate: { select: { firstName: true, lastName: true } },
      },
    });

    if (!currentApp) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Get new stage info and verify it belongs to the same job
    const newStage = await prisma.stage.findUnique({
      where: { id: stageId },
      select: { name: true, jobId: true },
    });

    if (!newStage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    if (newStage.jobId !== currentApp.jobId) {
      return NextResponse.json({ error: 'Stage does not belong to this job' }, { status: 400 });
    }

    // Update application stage
    const application = await prisma.application.update({
      where: { id: applicationId },
      data: { stageId, updatedAt: new Date() },
    });

    // Create stage history entry
    await prisma.stageHistory.create({
      data: { applicationId, stageId },
    });

    // Log activity
    await ActivityLogger.stageChange({
      applicationId,
      userId: auth.id,
      fromStage: currentApp.stage?.name || 'Unknown',
      toStage: newStage.name,
      candidateName: `${currentApp.candidate.firstName} ${currentApp.candidate.lastName}`,
    });

    // Execute automation rules unless skipped
    if (!skipAutomation) {
      if (currentApp.stageId && currentApp.stageId !== stageId) {
        await executeStageRules(applicationId, currentApp.stageId, 'onExit').catch(console.error);
      }
      await executeStageRules(applicationId, stageId, 'onEnter').catch(console.error);
    }

    return NextResponse.json({
      application,
      automationSkipped: skipAutomation || false,
    });
  } catch (error) {
    console.error('Failed to move stage:', error);
    return NextResponse.json({ error: 'Failed to move stage' }, { status: 500 });
  }
}
