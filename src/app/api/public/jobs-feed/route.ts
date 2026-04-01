import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { JobBoardType } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Unified Job Feed - XML feed compatible with all major job board aggregators.
 *
 * Usage:
 *   /api/public/jobs-feed              → All published jobs (default content)
 *   /api/public/jobs-feed?board=INDEED → Uses INDEED-specific post content when available
 *   /api/public/jobs-feed?board=LINKEDIN
 *   /api/public/jobs-feed?board=GLASSDOOR
 *   /api/public/jobs-feed?board=ZIPRECRUITER
 *
 * The feed uses the Indeed XML format which is accepted by:
 * Indeed, Glassdoor, ZipRecruiter, SimplyHired, Jooble, Adzuna, Talent.com, Neuvoo
 *
 * For LinkedIn Limited Listings, submit this URL with ?board=LINKEDIN to their partner team.
 */

const COMPANY_NAME = 'Acme Talent';
const COMPANY_URL = 'https://acmetalent.com';
const ATS_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';

function parseLocation(
  location: string | null,
  marketName: string
): { city: string; state: string; country: string } {
  const loc = location || marketName;
  const mappings: Record<string, { city: string; state: string; country: string }> = {
    nyc: { city: 'New York', state: 'NY', country: 'US' },
    'new york': { city: 'New York', state: 'NY', country: 'US' },
    la: { city: 'Los Angeles', state: 'CA', country: 'US' },
    'los angeles': { city: 'Los Angeles', state: 'CA', country: 'US' },
    sf: { city: 'San Francisco', state: 'CA', country: 'US' },
    'san francisco': { city: 'San Francisco', state: 'CA', country: 'US' },
    westside: { city: 'Westside', state: 'TN', country: 'US' },
    eastside: { city: 'Eastside', state: 'FL', country: 'US' },
    singapore: { city: 'Singapore', state: '', country: 'SG' },
    'hong kong': { city: 'Hong Kong', state: '', country: 'HK' },
  };

  const lower = loc.toLowerCase();
  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }

  const parts = loc.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1], country: 'US' };
  }
  return { city: loc, state: '', country: 'US' };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function cleanDescription(html: string | null): string {
  if (!html) return '';
  return html.replace(/]]>/g, ']]&gt;');
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: 'full-time',
  PART_TIME: 'part-time',
  CONTRACT: 'contract',
  INTERNSHIP: 'internship',
  TEMPORARY: 'temporary',
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardParam = searchParams.get('board')?.toUpperCase();

    // Validate board type if provided
    const boardType =
      boardParam && Object.values(JobBoardType).includes(boardParam as JobBoardType)
        ? (boardParam as JobBoardType)
        : null;

    // Fetch all published jobs with board-specific posts if requested
    const jobs = await prisma.job.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        market: { select: { name: true } },
        department: { select: { name: true } },
        office: { select: { name: true, location: true } },
        ...(boardType
          ? {
              posts: {
                where: { boardType, status: 'LIVE' },
                take: 1,
                select: { title: true, content: true, location: true },
              },
            }
          : {
              posts: {
                where: { status: 'LIVE' },
                take: 1,
                select: { title: true, content: true, location: true, boardType: true },
              },
            }),
      },
      orderBy: { createdAt: 'desc' },
    });

    const jobsXml = jobs
      .map((job) => {
        const post = job.posts?.[0];
        const location = parseLocation(
          post?.location || job.location || job.office?.location || null,
          job.market.name
        );
        const applyUrl = `${ATS_BASE_URL}/careers/${job.id}`;
        const description = cleanDescription(post?.content || job.description);
        const jobType = EMPLOYMENT_TYPE_MAP[job.employmentType] || 'part-time';
        const feedTitle = post?.title || job.title;

        return `  <job>
    <title><![CDATA[${feedTitle}]]></title>
    <date>${formatDate(job.createdAt)}</date>
    <referencenumber>${job.id}</referencenumber>
    <url>${escapeXml(applyUrl)}</url>
    <company><![CDATA[${COMPANY_NAME}]]></company>
    <city><![CDATA[${location.city}]]></city>
    <state>${escapeXml(location.state)}</state>
    <country>${escapeXml(location.country)}</country>
    <postalcode></postalcode>
    <description><![CDATA[${description}]]></description>
    <jobtype>${jobType}</jobtype>
    <category><![CDATA[${job.department?.name || 'Education'}]]></category>
    <experience></experience>
    <education></education>
  </job>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${escapeXml(COMPANY_NAME)}</publisher>
  <publisherurl>${escapeXml(COMPANY_URL)}</publisherurl>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${jobsXml}
</source>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Jobs feed error:', error);
    return new NextResponse('Error generating feed', { status: 500 });
  }
}
