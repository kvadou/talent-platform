import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { PatternType } from '@prisma/client';

/**
 * GET /api/patterns
 * List patterns with filtering and pagination
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');
  const patternType = searchParams.get('patternType') as PatternType | null;
  const isVerified = searchParams.get('isVerified');
  const positiveOnly = searchParams.get('positiveOnly') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where = {
    ...(jobId ? { jobId } : {}),
    ...(patternType ? { patternType } : {}),
    ...(isVerified !== null ? { isVerified: isVerified === 'true' } : {}),
    ...(positiveOnly ? { positiveSignal: true } : {}),
  };

  const [patterns, total] = await Promise.all([
    prisma.interviewPattern.findMany({
      where,
      include: {
        job: { select: { id: true, title: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { isVerified: 'desc' },
        { confidence: 'desc' },
        { exampleCount: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.interviewPattern.count({ where }),
  ]);

  // Get counts by status
  const [verifiedCount, unverifiedCount] = await Promise.all([
    prisma.interviewPattern.count({ where: { ...where, isVerified: true } }),
    prisma.interviewPattern.count({ where: { ...where, isVerified: false } }),
  ]);

  return NextResponse.json({
    patterns,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    counts: {
      verified: verifiedCount,
      unverified: unverifiedCount,
    },
  });
}
