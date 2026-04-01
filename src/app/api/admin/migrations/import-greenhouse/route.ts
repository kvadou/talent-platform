import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { importGreenhouseDataBatch } from '@/lib/integrations/greenhouse-importer-batch';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (user?.role !== 'HQ_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stats = await importGreenhouseDataBatch();
    
    return NextResponse.json({
      message: 'Greenhouse import completed',
      stats,
    });
  } catch (error: any) {
    console.error('Greenhouse import error:', error);
    return NextResponse.json(
      {
        error: 'Import failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
