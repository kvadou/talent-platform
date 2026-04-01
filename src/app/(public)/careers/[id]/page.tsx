import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { sanitizeHtml } from '@/lib/sanitize';
import WebflowNavbar from '@/components/public/WebflowNavbar';
import WebflowFooter from '@/components/public/WebflowFooter';
import ApplicationForm from '@/components/public/ApplicationForm';

const ATS_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';
const LOGO_URL = 'https://placehold.co/200x60/3BA9DA/white?text=Acme+Talent';

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACTOR',
  INTERNSHIP: 'INTERN',
  TEMPORARY: 'TEMPORARY',
};

function parseLocation(location: string | null, marketName: string) {
  const loc = location || marketName;
  const mappings: Record<string, { city: string; region: string; country: string }> = {
    nyc: { city: 'New York', region: 'NY', country: 'US' },
    'new york': { city: 'New York', region: 'NY', country: 'US' },
    la: { city: 'Los Angeles', region: 'CA', country: 'US' },
    'los angeles': { city: 'Los Angeles', region: 'CA', country: 'US' },
    westside: { city: 'Westside', region: 'TN', country: 'US' },
    eastside: { city: 'Eastside', region: 'FL', country: 'US' },
    singapore: { city: 'Singapore', region: '', country: 'SG' },
    'hong kong': { city: 'Hong Kong', region: '', country: 'HK' },
  };

  const lower = loc.toLowerCase();
  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }

  const parts = loc.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    return { city: parts[0], region: parts[1], country: 'US' };
  }
  return { city: loc, region: '', country: 'US' };
}

// Strips script tags and inline event handlers from admin-authored TipTap HTML
function sanitizeAdminHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: { title: true, location: true, market: { select: { name: true } } },
  });

  if (!job) return { title: 'Job Not Found' };

  const locationText = job.location || job.market.name;
  return {
    title: `${job.title} - ${locationText} | Acme Talent Careers`,
    description: `Apply for ${job.title} at Acme Talent in ${locationText}. Join our team teaching kids chess through storytelling.`,
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      employmentType: true,
      createdAt: true,
      department: { select: { name: true } },
      market: { select: { id: true, name: true } },
      questions: {
        select: {
          id: true,
          label: true,
          type: true,
          options: true,
          required: true,
          order: true,
          helpText: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
        <WebflowNavbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Position No Longer Available</h1>
            <p className="text-gray-600 mb-6">
              This job posting has been closed or is no longer accepting applications.
              Check out our other open positions below.
            </p>
            <Link
              href="/careers#openings"
              className="inline-block w-full px-6 py-3 bg-[#FDB913] text-gray-900 font-semibold rounded-full hover:bg-[#e5a711] transition-colors"
            >
              View Open Positions
            </Link>
          </div>
        </div>
        <WebflowFooter />
      </div>
    );
  }

  const locationText = job.location || job.market.name;
  const loc = parseLocation(job.location, job.market.name);
  const employmentType = EMPLOYMENT_TYPE_MAP[job.employmentType] || 'PART_TIME';

  // Google for Jobs JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || `${job.title} at Acme Talent`,
    identifier: {
      '@type': 'PropertyValue',
      name: 'Acme Talent',
      value: job.id,
    },
    datePosted: job.createdAt.toISOString().split('T')[0],
    employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Acme Talent',
      sameAs: 'https://acmetalent.com',
      logo: LOGO_URL,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: loc.city,
        addressRegion: loc.region,
        addressCountry: loc.country,
      },
    },
    directApply: true,
    applicationContact: {
      '@type': 'ContactPoint',
      url: `${ATS_BASE_URL}/careers/${job.id}`,
    },
  };

  const sanitizedDescription = job.description ? sanitizeAdminHtml(job.description) : null;
  const jsonLdScript = JSON.stringify(jsonLd);

  // Serialize questions for the client component
  const questionsData = job.questions.map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type as 'TEXT' | 'TEXTAREA' | 'SELECT' | 'BOOLEAN' | 'URL',
    options: (q.options as string[]) || [],
    required: q.required,
    helpText: q.helpText,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <WebflowNavbar />

      <div className="bg-[#1C9FDB]">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link
            href="/careers"
            className="text-white/80 hover:text-white text-sm transition-colors"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            &larr; Back to all jobs
          </Link>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1
            className="text-3xl font-bold text-gray-900 mb-3"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {job.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            <span className="flex items-center gap-1.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {locationText}
            </span>
            {job.department && (
              <span className="flex items-center gap-1.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {job.department.name}
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700">
              {employmentType.replace('_', '-').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          </div>

          <div className="mt-6">
            <a
              href="#apply"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#FDB913] text-gray-900 font-bold rounded-full hover:bg-[#e5a711] transition-colors shadow-md text-lg"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Apply Now
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {sanitizedDescription && (
        <div className="bg-white">
          <JobDescription html={sanitizedDescription} />
        </div>
      )}

      {/* Application Form */}
      <div id="apply" className="bg-cyan-50 scroll-mt-4">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center">
          <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Ready to join the team?
          </p>
        </div>
        <ApplicationForm
          jobId={job.id}
          jobTitle={job.title}
          marketId={job.market.id}
          questions={questionsData}
        />
      </div>

      <div className="flex-1" />
      <WebflowFooter />

      <JsonLdScript data={jsonLdScript} />
    </div>
  );
}

// Server component that renders sanitized admin HTML (from TipTap rich text editor)
function JobDescription({ html }: { html: string }) {
  return (
    <div
      className="max-w-4xl mx-auto px-4 py-8 text-gray-700 leading-relaxed
        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mb-3 [&_h1]:mt-6
        [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mb-2 [&_h2]:mt-5
        [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-4
        [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3
        [&_ul]:list-disc [&_ul]:pl-6
        [&_ol]:list-decimal [&_ol]:pl-6
        [&_li]:mb-1.5
        [&_strong]:font-semibold [&_strong]:text-gray-900
        [&_a]:text-cyan-600 [&_a]:underline"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

// Renders JSON-LD structured data script tag
function JsonLdScript({ data }: { data: string }) {
  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: data }} />
  );
}
