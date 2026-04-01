import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { getAllStageMetrics } from '@/lib/pipeline/metrics';

async function getPipeline(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      stages: { orderBy: { order: 'asc' }, select: { id: true, name: true, order: true } },
      applications: {
        select: {
          id: true,
          status: true,
          aiScore: true, // AI-generated application score
          candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
          stageId: true,
          // For days in stage calculation
          stageHistory: {
            where: { stageId: { not: undefined } },
            orderBy: { movedAt: 'desc' },
            take: 1,
            select: { movedAt: true }
          },
          createdAt: true,
          // For "needs decision" badge - completed interviews without scorecards
          interviews: {
            where: {
              scheduledAt: { lt: new Date() },
              scorecardId: null
            },
            select: { id: true }
          }
        }
      }
    }
  });

  if (!job) return null;

  // Fetch match scores for all candidates in this job
  const candidateIds = job.applications.map((app) => app.candidate.id);
  const matchScores = await prisma.jobCandidateMatch.findMany({
    where: {
      jobId,
      candidateId: { in: candidateIds },
    },
    select: {
      candidateId: true,
      combinedScore: true,
    },
  });

  // Create a map for quick lookup
  const scoreMap = new Map(
    matchScores.map((m) => [m.candidateId, m.combinedScore])
  );

  // Add match scores and computed fields to applications
  // Prefer aiScore (new) over JobCandidateMatch score (legacy)
  const applicationsWithScores = job.applications.map((app) => {
    // Calculate days in stage
    const stageEnteredAt = app.stageHistory[0]?.movedAt ?? app.createdAt;
    const daysInStage = Math.floor(
      (Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if needs decision (completed interviews without scorecards)
    const needsDecision = app.interviews.length > 0;

    return {
      id: app.id,
      status: app.status,
      stageId: app.stageId,
      candidate: app.candidate,
      matchScore: app.aiScore ?? scoreMap.get(app.candidate.id) ?? null,
      daysInStage,
      needsDecision,
    };
  });

  return {
    ...job,
    applications: applicationsWithScores,
  };
}

export default async function PipelinePage({ params }: { params: { id: string } }) {
  const job = await getPipeline(params.id);
  if (!job) return notFound();

  const stageIds = job.stages.map((s) => s.id);
  const metrics = await getAllStageMetrics(stageIds);

  return (
    <div className="space-y-4">
      {/* Kanban Board */}
      <div className="opacity-0 animate-reveal-1">
        <KanbanBoard
          jobId={job.id}
          stages={job.stages}
          applications={job.applications}
          metrics={metrics}
        />
      </div>
    </div>
  );
}
