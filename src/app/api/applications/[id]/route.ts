import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessApplication, requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!(await canAccessApplication(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const application = await prisma.application.findUnique({
    where: { id },
    include: { candidate: true, job: true, stage: true }
  });
  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ application });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;

  const { id } = await params;
  if (!(await canAccessApplication(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if application exists
  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Delete the application and related data
  // Prisma cascade will handle related records based on schema
  await prisma.application.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
