import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';

export async function GET() {
  const jobs = await prisma.job.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/careers</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${jobs
  .map(
    (job) => `  <url>
    <loc>${BASE_URL}/careers/${job.id}</loc>
    <lastmod>${job.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
