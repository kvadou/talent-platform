import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      employmentType: true,
      createdAt: true,
      department: {
        select: { name: true }
      },
      market: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      },
      questions: {
        select: {
          id: true,
          label: true,
          type: true,
          options: true,
          required: true,
          order: true,
          helpText: true
        },
        orderBy: { order: 'asc' }
      }
    }
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ job });
}
