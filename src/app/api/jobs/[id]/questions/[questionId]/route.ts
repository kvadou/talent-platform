import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH - Update a question
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, questionId } = await params;
  const body = await req.json();

  const question = await prisma.jobQuestion.update({
    where: { id: questionId, jobId },
    data: {
      label: body.label,
      type: body.type,
      options: body.options,
      required: body.required,
      helpText: body.helpText
    }
  });

  return NextResponse.json({ question });
}

// DELETE - Remove a question
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, questionId } = await params;

  await prisma.jobQuestion.delete({
    where: { id: questionId, jobId }
  });

  return NextResponse.json({ success: true });
}
