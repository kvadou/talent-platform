import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/scheduling/exceptions/[id] - Delete an exception
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the exception belongs to this user
    const exception = await prisma.scheduleException.findUnique({
      where: { id: params.id },
    });

    if (!exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    if (exception.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.scheduleException.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete exception:', error);
    return NextResponse.json({ error: 'Failed to delete exception' }, { status: 500 });
  }
}
