import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const notes = await prisma.note.findMany({
    where: { applicationId: params.id },
    include: { author: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ notes });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get or create database user from session
  const dbUser = await ensureUser();
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  
  const { content, isPrivate } = await req.json();
  const note = await prisma.note.create({
    data: { applicationId: params.id, authorId: dbUser.id, content, isPrivate: Boolean(isPrivate) }
  });
  return NextResponse.json({ note });
}
