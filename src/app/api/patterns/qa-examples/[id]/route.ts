import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const updateQASchema = z.object({
  isVerified: z.boolean().optional(),
  question: z.string().min(1).optional(),
  questionIntent: z.string().optional(),
  exampleAnswer: z.string().min(1).optional(),
  isGoodExample: z.boolean().optional(),
  explanation: z.string().optional(),
  qualityScore: z.number().min(1).max(5).optional(),
});

/**
 * GET /api/patterns/qa-examples/[id]
 * Get a single Q&A example
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

  const example = await prisma.questionAnswerExample.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, title: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!example) {
    return NextResponse.json({ error: 'Q&A example not found' }, { status: 404 });
  }

  return NextResponse.json(example);
}

/**
 * PATCH /api/patterns/qa-examples/[id]
 * Update a Q&A example (verify, edit, adjust quality)
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
  const validation = updateQASchema.safeParse(body);
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

  if (data.question !== undefined) updateData.question = data.question;
  if (data.questionIntent !== undefined) updateData.questionIntent = data.questionIntent;
  if (data.exampleAnswer !== undefined) updateData.exampleAnswer = data.exampleAnswer;
  if (data.isGoodExample !== undefined) updateData.isGoodExample = data.isGoodExample;
  if (data.explanation !== undefined) updateData.explanation = data.explanation;
  if (data.qualityScore !== undefined) updateData.qualityScore = data.qualityScore;

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

  const example = await prisma.questionAnswerExample.update({
    where: { id },
    data: updateData,
    include: {
      job: { select: { id: true, title: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(example);
}

/**
 * DELETE /api/patterns/qa-examples/[id]
 * Delete a Q&A example
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

  await prisma.questionAnswerExample.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
