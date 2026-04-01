import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET - List all interview kits for a job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;

  const interviewKits = await prisma.interviewKit.findMany({
    where: { jobId },
    include: {
      stage: {
        select: { id: true, name: true, order: true },
      },
      prepItems: {
        orderBy: { order: 'asc' },
      },
      categories: {
        orderBy: { order: 'asc' },
        include: {
          attributes: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json({ interviewKits });
}

// POST - Create a new interview kit for a job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;
  const body = await req.json();
  const { name, type, duration, stageId, includesAudition, prepItems, categories } = body;

  if (!name || !type) {
    return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
  }

  // Get the highest order number
  const lastKit = await prisma.interviewKit.findFirst({
    where: { jobId },
    orderBy: { order: 'desc' },
  });

  const newOrder = (lastKit?.order ?? 0) + 1;

  // Create the interview kit with nested prep items and categories
  const interviewKit = await prisma.interviewKit.create({
    data: {
      jobId,
      stageId: stageId || null,
      name,
      type,
      duration: duration || 30,
      includesAudition: includesAudition || false,
      order: newOrder,
      prepItems: prepItems?.length ? {
        create: prepItems.map((item: { title: string; description?: string; duration?: number }, index: number) => ({
          title: item.title,
          description: item.description || null,
          duration: item.duration || null,
          order: index,
        })),
      } : undefined,
      categories: categories?.length ? {
        create: categories.map((cat: { name: string; attributes?: Array<{ name: string; description?: string; required?: boolean }> }, catIndex: number) => ({
          name: cat.name,
          order: catIndex,
          attributes: cat.attributes?.length ? {
            create: cat.attributes.map((attr, attrIndex) => ({
              name: attr.name,
              description: attr.description || null,
              required: attr.required !== false,
              order: attrIndex,
            })),
          } : undefined,
        })),
      } : undefined,
    },
    include: {
      stage: {
        select: { id: true, name: true, order: true },
      },
      prepItems: {
        orderBy: { order: 'asc' },
      },
      categories: {
        orderBy: { order: 'asc' },
        include: {
          attributes: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  return NextResponse.json(interviewKit, { status: 201 });
}
