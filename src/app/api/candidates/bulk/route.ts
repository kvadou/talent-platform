import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, candidateIds } = body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json({ error: 'No candidates selected' }, { status: 400 });
    }

    switch (action) {
      case 'add_tag': {
        const { tag } = body;
        if (!tag || typeof tag !== 'string') {
          return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
        }

        // For each candidate, add the tag if not already present
        await prisma.$transaction(async (tx) => {
          for (const candidateId of candidateIds) {
            const candidate = await tx.candidate.findUnique({
              where: { id: candidateId },
              select: { tags: true },
            });

            if (candidate && !candidate.tags.includes(tag)) {
              await tx.candidate.update({
                where: { id: candidateId },
                data: {
                  tags: [...candidate.tags, tag],
                },
              });
            }
          }
        });

        return NextResponse.json({
          success: true,
          message: `Added tag "${tag}" to ${candidateIds.length} candidates`,
          count: candidateIds.length,
        });
      }

      case 'remove_tag': {
        const { tag } = body;
        if (!tag || typeof tag !== 'string') {
          return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
        }

        // For each candidate, remove the tag if present
        await prisma.$transaction(async (tx) => {
          for (const candidateId of candidateIds) {
            const candidate = await tx.candidate.findUnique({
              where: { id: candidateId },
              select: { tags: true },
            });

            if (candidate && candidate.tags.includes(tag)) {
              await tx.candidate.update({
                where: { id: candidateId },
                data: {
                  tags: candidate.tags.filter((t) => t !== tag),
                },
              });
            }
          }
        });

        return NextResponse.json({
          success: true,
          message: `Removed tag "${tag}" from ${candidateIds.length} candidates`,
          count: candidateIds.length,
        });
      }

      case 'export': {
        // Get all candidates with their applications
        const candidates = await prisma.candidate.findMany({
          where: { id: { in: candidateIds } },
          include: {
            applications: {
              include: {
                job: { select: { title: true } },
                stage: { select: { name: true } },
              },
            },
          },
        });

        // Build CSV
        const headers = [
          'First Name',
          'Last Name',
          'Email',
          'Phone',
          'City',
          'State',
          'Country',
          'Tags',
          'Applications',
          'Created At',
        ];

        const rows = candidates.map((c) => [
          c.firstName,
          c.lastName,
          c.email,
          c.phone || '',
          c.city || '',
          c.state || '',
          c.country || '',
          c.tags.join('; '),
          c.applications.map((a) => `${a.job.title} (${a.stage.name})`).join('; '),
          c.createdAt.toISOString(),
        ]);

        const csv = [
          headers.join(','),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
          ),
        ].join('\n');

        return NextResponse.json({
          success: true,
          csv,
          filename: `candidates-export-${Date.now()}.csv`,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bulk candidate action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
