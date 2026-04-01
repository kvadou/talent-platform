import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema for imported candidates
const candidateRowSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  portfolioUrl: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

const importSchema = z.object({
  candidates: z.array(candidateRowSchema),
  jobId: z.string().optional().nullable(),
  skipDuplicates: z.boolean().default(true),
  addToStage: z.string().optional().nullable(),
});

// GET /api/bulk-import - Get import history (placeholder)
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return empty for now - import history can be added later
    return NextResponse.json({ recentImports: [] });
  } catch (error) {
    console.error('Error fetching import history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import history' },
      { status: 500 }
    );
  }
}

// POST /api/bulk-import - Import candidates
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { candidates, jobId, skipDuplicates, addToStage } = parsed.data;

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If importing to a job, get the first stage
    let stageId = addToStage;
    if (jobId && !stageId) {
      const firstStage = await prisma.stage.findFirst({
        where: { jobId },
        orderBy: { order: 'asc' },
      });
      if (firstStage) {
        stageId = firstStage.id;
      }
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as { row: number; email: string; error: string }[],
    };

    for (let i = 0; i < candidates.length; i++) {
      const candidateData = candidates[i];

      try {
        // Check for duplicate by email
        if (skipDuplicates) {
          const existing = await prisma.candidate.findFirst({
            where: { email: candidateData.email },
          });

          if (existing) {
            results.skipped++;
            continue;
          }
        }

        // Create the candidate
        const candidate = await prisma.candidate.create({
          data: {
            firstName: candidateData.firstName,
            lastName: candidateData.lastName,
            email: candidateData.email,
            phone: candidateData.phone,
            linkedinUrl: candidateData.linkedinUrl,
            portfolioUrl: candidateData.portfolioUrl,
            city: candidateData.city,
            state: candidateData.state,
            country: candidateData.country,
            notes: candidateData.notes,
            tags: candidateData.tags || [],
            source: 'OTHER', // Using OTHER for bulk imports
          },
        });

        // If a job is specified, create an application
        if (jobId && stageId) {
          await prisma.application.create({
            data: {
              candidateId: candidate.id,
              jobId,
              stageId,
              status: 'ACTIVE',
              source: 'Bulk Import',
            },
          });
        }

        results.imported++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check if it's a unique constraint error
        if (errorMessage.includes('Unique constraint')) {
          results.skipped++;
        } else {
          results.errors.push({
            row: i + 1,
            email: candidateData.email,
            error: errorMessage,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error importing candidates:', error);
    return NextResponse.json(
      { error: 'Failed to import candidates' },
      { status: 500 }
    );
  }
}
