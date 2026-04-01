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
    return NextResponse.json({ offices: [] });
  }

  const offices = await prisma.office.findMany({
    where: { organizationId: org.id },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ offices });
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

  const { name, location, timezone } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const office = await prisma.office.create({
    data: {
      name,
      location: location || null,
      timezone: timezone || null,
      organizationId: org.id,
    },
  });

  return NextResponse.json(office, { status: 201 });
}
