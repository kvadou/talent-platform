import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/jobs/[id]/keywords - List all keywords for a job
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;

  // Verify job exists
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, title: true },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const keywords = await prisma.jobKeyword.findMany({
    where: { jobId },
    orderBy: [{ weight: 'desc' }, { keyword: 'asc' }],
  });

  return NextResponse.json({ keywords });
}

// POST /api/jobs/[id]/keywords - Add a keyword
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;

  // Verify job exists
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { keyword, expansions = [], weight = 5 } = body;

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: 'keyword is required and must be a string' },
        { status: 400 }
      );
    }

    const normalizedKeyword = keyword.trim().toLowerCase();

    // Check for duplicate
    const existing = await prisma.jobKeyword.findUnique({
      where: { jobId_keyword: { jobId, keyword: normalizedKeyword } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Keyword already exists for this job' },
        { status: 409 }
      );
    }

    const created = await prisma.jobKeyword.create({
      data: {
        jobId,
        keyword: normalizedKeyword,
        expansions: Array.isArray(expansions)
          ? expansions.map((e: string) => e.toLowerCase().trim())
          : [],
        weight: Math.min(10, Math.max(1, parseInt(weight) || 5)),
      },
    });

    return NextResponse.json({ keyword: created }, { status: 201 });
  } catch (err) {
    console.error('Error creating keyword:', err);
    return NextResponse.json(
      { error: 'Failed to create keyword' },
      { status: 500 }
    );
  }
}

// PUT /api/jobs/[id]/keywords - Update a keyword (expects keywordId in body)
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;

  try {
    const body = await req.json();
    const { keywordId, expansions, weight } = body;

    if (!keywordId) {
      return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
    }

    // Verify keyword belongs to this job
    const existing = await prisma.jobKeyword.findFirst({
      where: { id: keywordId, jobId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (Array.isArray(expansions)) {
      updateData.expansions = expansions.map((e: string) => e.toLowerCase().trim());
    }
    if (typeof weight === 'number') {
      updateData.weight = Math.min(10, Math.max(1, weight));
    }

    const updated = await prisma.jobKeyword.update({
      where: { id: keywordId },
      data: updateData,
    });

    return NextResponse.json({ keyword: updated });
  } catch (err) {
    console.error('Error updating keyword:', err);
    return NextResponse.json(
      { error: 'Failed to update keyword' },
      { status: 500 }
    );
  }
}

// DELETE /api/jobs/[id]/keywords - Delete a keyword (expects keywordId in query)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;
  const { searchParams } = new URL(req.url);
  const keywordId = searchParams.get('keywordId');

  if (!keywordId) {
    return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
  }

  // Verify keyword belongs to this job
  const existing = await prisma.jobKeyword.findFirst({
    where: { id: keywordId, jobId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
  }

  await prisma.jobKeyword.delete({ where: { id: keywordId } });

  return NextResponse.json({ success: true });
}
