import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const updatePatternSchema = z.object({
  isVerified: z.boolean().optional(),
  pattern: z.string().min(1).optional(),
  context: z.string().optional(),
  positiveSignal: z.boolean().optional(),
  weight: z.number().min(0).max(10).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * GET /api/patterns/[id]
 * Get a single pattern
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const pattern = await prisma.interviewPattern.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, title: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!pattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
  }

  return NextResponse.json(pattern);
}

/**
 * PATCH /api/patterns/[id]
 * Update a pattern (verify, edit, adjust weight)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json();
  const validation = updatePatternSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Get the user from our database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (data.pattern !== undefined) updateData.pattern = data.pattern;
  if (data.context !== undefined) updateData.context = data.context;
  if (data.positiveSignal !== undefined) updateData.positiveSignal = data.positiveSignal;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.confidence !== undefined) updateData.confidence = data.confidence;

  // Handle verification
  if (data.isVerified !== undefined) {
    updateData.isVerified = data.isVerified;
    if (data.isVerified) {
      updateData.verifiedById = user.id;
      updateData.verifiedAt = new Date();
    } else {
      updateData.verifiedById = null;
      updateData.verifiedAt = null;
    }
  }

  const pattern = await prisma.interviewPattern.update({
    where: { id },
    data: updateData,
    include: {
      job: { select: { id: true, title: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(pattern);
}

/**
 * DELETE /api/patterns/[id]
 * Delete a pattern
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await prisma.interviewPattern.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
