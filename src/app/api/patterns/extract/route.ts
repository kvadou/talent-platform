import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runPatternExtractionJob, consolidatePatterns } from '@/lib/pattern-extraction';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/patterns/extract
 * Trigger pattern extraction job
 * Only HQ_ADMIN can run this
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (user?.role !== 'HQ_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { jobId, limit = 50, consolidate = true } = body;

  try {
    // Run extraction
    const extractionResult = await runPatternExtractionJob({
      jobId,
      limit,
      minRetentionDays: 30,
    });

    // Optionally consolidate similar patterns
    let consolidationResult = { merged: 0, updated: 0 };
    if (consolidate) {
      consolidationResult = await consolidatePatterns(jobId);
    }

    return NextResponse.json({
      success: true,
      extraction: extractionResult,
      consolidation: consolidationResult,
    });
  } catch (error) {
    console.error('Pattern extraction failed:', error);
    return NextResponse.json(
      { error: 'Pattern extraction failed', details: String(error) },
      { status: 500 }
    );
  }
}
