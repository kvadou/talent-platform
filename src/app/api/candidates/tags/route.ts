import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all unique tags from candidates
  const candidates = await prisma.candidate.findMany({
    where: {
      tags: { isEmpty: false },
    },
    select: {
      tags: true,
    },
  });

  // Flatten and dedupe tags
  const allTags = new Set<string>();
  for (const candidate of candidates) {
    for (const tag of candidate.tags) {
      allTags.add(tag);
    }
  }

  // Sort alphabetically
  const sortedTags = Array.from(allTags).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  return NextResponse.json({ tags: sortedTags });
}
