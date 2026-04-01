import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateJobEmbedding } from '@/lib/matching';

// POST /api/jobs/[id]/embedding - Generate/update embedding for a job
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;

  try {
    const success = await updateJobEmbedding(jobId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to generate embedding. Job may have insufficient data.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, jobId });
  } catch (err) {
    console.error('Error generating job embedding:', err);
    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    );
  }
}
