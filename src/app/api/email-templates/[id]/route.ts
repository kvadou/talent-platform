import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';

// GET - Fetch single template
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const template = await prisma.emailTemplate.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, title: true } },
      stage: { select: { id: true, name: true } }
    }
  });

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template });
}

// PATCH - Update template
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureUser();

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.emailTemplate.findUnique({
    where: { id }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // If setting as default, unset other defaults of same type
  if (body.isDefault && body.type) {
    await prisma.emailTemplate.updateMany({
      where: {
        type: body.type,
        isDefault: true,
        id: { not: id }
      },
      data: { isDefault: false }
    });
  }

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      type: body.type ?? existing.type,
      description: body.description,
      subject: body.subject ?? existing.subject,
      body: body.body ?? existing.body,
      scope: body.scope ?? existing.scope,
      isDefault: body.isDefault ?? existing.isDefault,
      jobId: body.jobId ?? existing.jobId,
      stageId: body.stageId ?? existing.stageId,
      mergeFields: body.mergeFields ?? existing.mergeFields
    }
  });

  return NextResponse.json({ template });
}

// DELETE - Remove template
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.emailTemplate.findUnique({
    where: { id }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  await prisma.emailTemplate.delete({
    where: { id }
  });

  return NextResponse.json({ success: true });
}
