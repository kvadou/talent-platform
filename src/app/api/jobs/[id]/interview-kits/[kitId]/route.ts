import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET - Get a single interview kit
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { kitId } = await params;

  const interviewKit = await prisma.interviewKit.findUnique({
    where: { id: kitId },
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

  if (!interviewKit) {
    return NextResponse.json({ error: 'Interview kit not found' }, { status: 404 });
  }

  return NextResponse.json(interviewKit);
}

// PUT - Update an interview kit
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { kitId } = await params;
  const body = await req.json();
  const { name, type, duration, stageId, includesAudition, prepItems, categories } = body;

  // Use a transaction to update kit, prep items, and categories
  const updatedKit = await prisma.$transaction(async (tx) => {
    // Update the main interview kit
    await tx.interviewKit.update({
      where: { id: kitId },
      data: {
        name,
        type,
        duration,
        stageId: stageId || null,
        includesAudition,
      },
    });

    // If prepItems are provided, replace them
    if (prepItems !== undefined) {
      // Delete existing prep items
      await tx.interviewKitPrepItem.deleteMany({
        where: { kitId },
      });

      // Create new prep items
      if (prepItems.length > 0) {
        await tx.interviewKitPrepItem.createMany({
          data: prepItems.map((item: { title: string; description?: string; duration?: number }, index: number) => ({
            kitId,
            title: item.title,
            description: item.description || null,
            duration: item.duration || null,
            order: index,
          })),
        });
      }
    }

    // If categories are provided, replace them
    if (categories !== undefined) {
      // Delete existing categories (cascades to attributes)
      await tx.interviewKitCategory.deleteMany({
        where: { kitId },
      });

      // Create new categories with attributes
      for (let catIndex = 0; catIndex < categories.length; catIndex++) {
        const cat = categories[catIndex];
        await tx.interviewKitCategory.create({
          data: {
            kitId,
            name: cat.name,
            order: catIndex,
            attributes: cat.attributes?.length ? {
              create: cat.attributes.map((attr: { name: string; description?: string; required?: boolean }, attrIndex: number) => ({
                name: attr.name,
                description: attr.description || null,
                required: attr.required !== false,
                order: attrIndex,
              })),
            } : undefined,
          },
        });
      }
    }

    // Return the updated kit with all relations
    return tx.interviewKit.findUnique({
      where: { id: kitId },
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
  });

  return NextResponse.json(updatedKit);
}

// DELETE - Delete an interview kit
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { kitId } = await params;

  await prisma.interviewKit.delete({
    where: { id: kitId },
  });

  return NextResponse.json({ success: true });
}
