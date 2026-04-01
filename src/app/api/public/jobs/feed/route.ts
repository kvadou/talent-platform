import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CORS headers for Webflow embed
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, restrict to acmetalent.com
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get('market');

  // Base URL for apply links - configurable via env
  const applyBaseUrl = process.env.APPLY_BASE_URL || 'https://apply.acmetalent.com';

  const where = {
    status: 'PUBLISHED' as const,
    ...(market ? { market: { slug: market } } : {})
  };

  const jobs = await prisma.job.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      createdAt: true,
      updatedAt: true,
      market: {
        select: {
          slug: true,
          name: true
        }
      },
      questions: {
        select: {
          id: true,
          label: true,
          type: true,
          options: true,
          required: true,
          order: true,
          helpText: true
        },
        orderBy: { order: 'asc' }
      },
      _count: {
        select: {
          applications: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Transform for Webflow consumption
  const feed = jobs.map(job => ({
    id: job.id,
    title: job.title,
    description: job.description,
    location: job.location || 'Remote',
    market: job.market.name,
    marketSlug: job.market.slug,
    postedAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    applyUrl: `${applyBaseUrl}/careers/${job.id}`,
    questionCount: job.questions.length,
    // Optionally include questions for dynamic form rendering
    questions: job.questions
  }));

  return NextResponse.json(
    {
      jobs: feed,
      meta: {
        total: feed.length,
        generatedAt: new Date().toISOString()
      }
    },
    { headers: corsHeaders }
  );
}
