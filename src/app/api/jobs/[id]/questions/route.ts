import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all questions for a job
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;

  const questions = await prisma.jobQuestion.findMany({
    where: { jobId },
    orderBy: { order: 'asc' }
  });

  return NextResponse.json({ questions });
}

// POST - Create a new question
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;
  const body = await req.json();

  // Get max order for this job
  const maxOrder = await prisma.jobQuestion.aggregate({
    where: { jobId },
    _max: { order: true }
  });

  const question = await prisma.jobQuestion.create({
    data: {
      jobId,
      label: body.label,
      type: body.type || 'TEXT',
      options: body.options || [],
      required: body.required || false,
      order: (maxOrder._max.order ?? -1) + 1,
      helpText: body.helpText || null
    }
  });

  return NextResponse.json({ question }, { status: 201 });
}

// PUT - Bulk update questions (for reordering)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;
  const { questions } = await req.json();

  // Update all questions with new orders
  await prisma.$transaction(
    questions.map((q: { id: string; order: number }) =>
      prisma.jobQuestion.update({
        where: { id: q.id, jobId },
        data: { order: q.order }
      })
    )
  );

  const updated = await prisma.jobQuestion.findMany({
    where: { jobId },
    orderBy: { order: 'asc' }
  });

  return NextResponse.json({ questions: updated });
}
