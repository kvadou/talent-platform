import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getUserOrganization } from '@/lib/market-scope';

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await getUserOrganization(session.user.email);
  if (!org) {
    return NextResponse.json({ departments: [] });
  }

  const departments = await prisma.department.findMany({
    where: { organizationId: org.id },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ departments });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await getUserOrganization(session.user.email);
  if (!org) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const { name } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const department = await prisma.department.create({
    data: {
      name,
      organizationId: org.id,
    },
  });

  return NextResponse.json(department, { status: 201 });
}
