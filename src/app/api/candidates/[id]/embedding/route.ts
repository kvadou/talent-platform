import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateCandidateEmbedding } from '@/lib/matching';

// POST /api/candidates/[id]/embedding - Generate/update embedding for a candidate
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: candidateId } = params;

  try {
    const success = await updateCandidateEmbedding(candidateId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to generate embedding. Candidate may have insufficient data.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, candidateId });
  } catch (err) {
    console.error('Error generating candidate embedding:', err);
    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    );
  }
}
