import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const sequences = await prisma.sequence.findMany({
    include: {
      stageRules: {
        select: {
          id: true,
          stage: { select: { name: true, job: { select: { title: true } } } }
        }
      },
      instances: {
        select: {
          id: true,
          status: true,
          application: {
            select: {
              candidate: { select: { firstName: true, lastName: true } }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json({ sequences });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const body = await req.json();
  const { name, description, steps, isActive } = body;
  
  if (!name || !steps || !Array.isArray(steps)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // Validate steps
  for (const step of steps) {
    if (typeof step.delay !== 'number' || !step.templateId || typeof step.cancelOnReply !== 'boolean') {
      return NextResponse.json({ error: 'Invalid step format' }, { status: 400 });
    }
  }
  
  const sequence = await prisma.sequence.create({
    data: {
      name,
      description: description || null,
      steps: steps,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    }
  });
  
  return NextResponse.json({ sequence });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const body = await req.json();
  const { id, name, description, steps, isActive } = body;
  
  if (!id) {
    return NextResponse.json({ error: 'Sequence ID is required' }, { status: 400 });
  }
  
  const updateData: any = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (steps) updateData.steps = steps;
  if (isActive !== undefined) updateData.isActive = isActive;
  
  const sequence = await prisma.sequence.update({
    where: { id },
    data: updateData
  });
  
  return NextResponse.json({ sequence });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'Sequence ID is required' }, { status: 400 });
  }
  
  await prisma.sequence.delete({
    where: { id }
  });
  
  return NextResponse.json({ success: true });
}

