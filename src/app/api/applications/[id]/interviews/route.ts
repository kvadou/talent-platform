import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessApplication, requireApiUser } from '@/lib/api-auth';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  if (!(await canAccessApplication(auth.email, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const interviews = await prisma.interview.findMany({
    where: { applicationId: params.id },
    include: { interviewer: true },
    orderBy: { scheduledAt: 'desc' }
  });
  return NextResponse.json({ interviews });
}
