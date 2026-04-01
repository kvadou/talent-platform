import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/patterns/qa-examples
 * List Q&A examples with filtering and pagination
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');
  const isVerified = searchParams.get('isVerified');
  const isGoodExample = searchParams.get('isGoodExample');
  const minQuality = parseInt(searchParams.get('minQuality') || '0');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where = {
    ...(jobId ? { jobId } : {}),
    ...(isVerified !== null ? { isVerified: isVerified === 'true' } : {}),
    ...(isGoodExample !== null ? { isGoodExample: isGoodExample === 'true' } : {}),
    ...(minQuality > 0 ? { qualityScore: { gte: minQuality } } : {}),
  };

  const [examples, total] = await Promise.all([
    prisma.questionAnswerExample.findMany({
      where,
      include: {
        job: { select: { id: true, title: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { isVerified: 'desc' },
        { qualityScore: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.questionAnswerExample.count({ where }),
  ]);

  // Get counts
  const [verifiedCount, unverifiedCount, goodCount, badCount] = await Promise.all([
    prisma.questionAnswerExample.count({ where: { ...where, isVerified: true } }),
    prisma.questionAnswerExample.count({ where: { ...where, isVerified: false } }),
    prisma.questionAnswerExample.count({ where: { ...where, isGoodExample: true } }),
    prisma.questionAnswerExample.count({ where: { ...where, isGoodExample: false } }),
  ]);

  return NextResponse.json({
    examples,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    counts: {
      verified: verifiedCount,
      unverified: unverifiedCount,
      good: goodCount,
      bad: badCount,
    },
  });
}
