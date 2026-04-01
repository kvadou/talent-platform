import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Indeed XML Feed
 *
 * Generates an XML feed of published jobs for Indeed to crawl.
 * Register this URL with Indeed Publisher Portal:
 * https://hiring.acmetalent.com/api/public/indeed-feed
 *
 * Indeed XML Specification:
 * https://developers.indeed.com/docs/xml-feed-specification
 */

const COMPANY_NAME = 'Acme Talent';
const COMPANY_URL = 'https://acmetalent.com';
const ATS_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';

// Map market locations to city/state/country
function parseLocation(location: string | null, marketName: string): { city: string; state: string; country: string } {
  // Default to market name parsing if no location
  const loc = location || marketName;

  // Common market mappings
  const marketMappings: Record<string, { city: string; state: string; country: string }> = {
    'NYC': { city: 'New York', state: 'NY', country: 'US' },
    'New York': { city: 'New York', state: 'NY', country: 'US' },
    'LA': { city: 'Los Angeles', state: 'CA', country: 'US' },
    'Los Angeles': { city: 'Los Angeles', state: 'CA', country: 'US' },
    'SF': { city: 'San Francisco', state: 'CA', country: 'US' },
    'San Francisco': { city: 'San Francisco', state: 'CA', country: 'US' },
    'Westside': { city: 'Westside', state: 'TN', country: 'US' },
    'Eastside': { city: 'Eastside', state: 'FL', country: 'US' },
    'Singapore': { city: 'Singapore', state: '', country: 'SG' },
    'Hong Kong': { city: 'Hong Kong', state: '', country: 'HK' },
  };

  // Check for exact market match
  for (const [key, value] of Object.entries(marketMappings)) {
    if (loc.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Try to parse "City, ST" format
  const parts = loc.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return {
      city: parts[0],
      state: parts[1],
      country: 'US'
    };
  }

  // Fallback
  return {
    city: loc,
    state: '',
    country: 'US'
  };
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Strip HTML tags for plain text description (Indeed prefers CDATA with HTML)
function cleanDescription(html: string | null): string {
  if (!html) return '';
  // Keep HTML but ensure it's valid for CDATA
  return html.replace(/]]>/g, ']]&gt;');
}

export async function GET() {
  try {
    // Fetch all published jobs with market info and live Indeed posts
    const jobs = await prisma.job.findMany({
      where: {
        status: 'PUBLISHED'
      },
      include: {
        market: {
          select: {
            name: true
          }
        },
        department: {
          select: {
            name: true
          }
        },
        office: {
          select: {
            name: true,
            location: true
          }
        },
        posts: {
          where: {
            boardType: 'INDEED',
            status: 'LIVE',
          },
          take: 1,
          select: {
            title: true,
            content: true,
            location: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Build XML
    const jobsXml = jobs.map(job => {
      const indeedPost = job.posts?.[0];
      const location = parseLocation(
        indeedPost?.location || job.location || job.office?.location || null,
        job.market.name
      );

      const applyUrl = `${ATS_BASE_URL}/careers/${job.id}`;
      const description = cleanDescription(indeedPost?.content || job.description);

      // Employment type mapping
      const employmentTypeMap: Record<string, string> = {
        'FULL_TIME': 'full-time',
        'PART_TIME': 'part-time',
        'CONTRACT': 'contract',
        'INTERNSHIP': 'internship',
        'TEMPORARY': 'temporary'
      };
      const jobType = employmentTypeMap[job.employmentType] || 'part-time';

      const feedTitle = indeedPost?.title || job.title;

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
    }).join('\n');

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
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Indeed feed error:', error);
    return new NextResponse('Error generating feed', { status: 500 });
  }
}
