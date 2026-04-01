import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';
import { Prisma } from '@prisma/client';
import { parseSearchQuery } from '@/lib/search';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      city,
      state,
      country,
      currentCompany,
      currentTitle,
      linkedinUrl,
      portfolioUrl,
      resumeUrl,
      tags,
      source,
      sourceDetails,
      notes,
    } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    // Email is required in schema - generate placeholder if not provided
    const candidateEmail = email?.trim() || `no-email-${Date.now()}@placeholder.local`;

    const candidate = await prisma.candidate.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: candidateEmail,
        phone: phone || null,
        city: city || null,
        state: state || null,
        country: country || null,
        linkedinUrl: linkedinUrl || null,
        portfolioUrl: portfolioUrl || null,
        resumeUrl: resumeUrl || null,
        tags: tags || [],
        source: source || 'CAREER_PAGE',
        sourceDetails: sourceDetails || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error('Failed to create candidate:', error);
    return NextResponse.json(
      { error: 'Failed to create candidate' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const fullTextSearch = searchParams.get('fullTextSearch') === 'true';
  const hasApplications = searchParams.get('hasApplications');
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const source = searchParams.get('source');
  const stageId = searchParams.get('stageId');
  const status = searchParams.get('status');
  const jobId = searchParams.get('jobId');
  const appliedAfter = searchParams.get('appliedAfter');
  const appliedBefore = searchParams.get('appliedBefore');
  const sortBy = searchParams.get('sortBy') || 'updatedAt'; // updatedAt, relevance, createdAt
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100); // Default 50, max 100 per page
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const skip = (page - 1) * limit;

  // If full-text search is enabled and we have a search query, use raw SQL
  if (fullTextSearch && search.trim()) {
    return await handleFullTextSearch(req, {
      search: search.trim(),
      hasApplications,
      tags,
      source,
      stageId,
      status,
      jobId,
      appliedAfter,
      appliedBefore,
      sortBy,
      limit,
      skip,
      page,
      access,
    });
  }

  // Standard search using Prisma
  const where: any = {};

  // Basic search filter (ILIKE)
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Tags filter
  if (tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  // Source filter
  if (source) {
    where.source = source;
  }

  // Application filters
  const applicationWhere: any = {};
  if (stageId) applicationWhere.stageId = stageId;
  if (status) applicationWhere.status = status;
  if (jobId) applicationWhere.jobId = jobId;
  if (appliedAfter) applicationWhere.createdAt = { ...applicationWhere.createdAt, gte: new Date(appliedAfter) };
  if (appliedBefore) applicationWhere.createdAt = { ...applicationWhere.createdAt, lte: new Date(appliedBefore) };

  // Filter by applications
  if (hasApplications === 'true' || Object.keys(applicationWhere).length > 0) {
    where.applications = { some: applicationWhere };
  } else if (hasApplications === 'false') {
    where.applications = { none: {} };
  }

  // Filter by market access
  if (access.marketIds && access.marketIds.length > 0) {
    if (!where.applications) {
      where.applications = { some: {} };
    }
    where.applications.some = {
      ...where.applications.some,
      job: {
        marketId: { in: access.marketIds },
      },
    };
  }

  // Determine sort order
  const orderBy: any = sortBy === 'createdAt'
    ? { createdAt: 'desc' }
    : { updatedAt: 'desc' };

  // Get total count for pagination
  const total = await prisma.candidate.count({ where });

  const candidates = await prisma.candidate.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      country: true,
      resumeUrl: true,
      linkedinUrl: true,
      portfolioUrl: true,
      tags: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      greenhouseCandidateId: true,
      _count: {
        select: {
          applications: true,
        },
      },
      applications: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              title: true,
              market: {
                select: {
                  name: true,
                },
              },
            },
          },
          stage: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 5,
      },
    },
    orderBy,
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    candidates,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    }
  });
}

async function handleFullTextSearch(
  req: Request,
  options: {
    search: string;
    hasApplications: string | null;
    tags: string[];
    source: string | null;
    stageId: string | null;
    status: string | null;
    jobId: string | null;
    appliedAfter: string | null;
    appliedBefore: string | null;
    sortBy: string;
    limit: number;
    skip: number;
    page: number;
    access: { marketIds?: string[] | null };
  }
) {
  const {
    search,
    hasApplications,
    tags,
    source,
    stageId,
    status,
    jobId,
    appliedAfter,
    appliedBefore,
    sortBy,
    limit,
    skip,
    page,
    access,
  } = options;

  // Parse the search query using the advanced parser
  const parsed = parseSearchQuery(search);

  // Build conditions and params
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Add full-text search condition if we have a tsQuery
  if (parsed.sql.tsQuery) {
    conditions.push(`c."searchVector" @@ to_tsquery('english', $${paramIndex})`);
    params.push(parsed.sql.tsQuery);
    paramIndex++;
  }

  // Add field-specific conditions from parsed query
  for (const condition of parsed.sql.whereConditions) {
    // Adjust parameter placeholders to match our paramIndex
    const adjustedCondition = condition.replace(/\$(\d+)/g, (_, num) => {
      return `$${paramIndex + parseInt(num) - 1}`;
    });
    conditions.push(adjustedCondition);
  }
  params.push(...parsed.sql.params);
  paramIndex += parsed.sql.params.length;

  // Tags filter (from URL params, not search query)
  if (tags.length > 0) {
    conditions.push(`c.tags && $${paramIndex}`);
    params.push(tags);
    paramIndex++;
  }

  // Source filter (from URL params)
  if (source) {
    conditions.push(`c.source = $${paramIndex}`);
    params.push(source);
    paramIndex++;
  }

  // Build application subquery conditions
  const appConditions: string[] = [];
  if (stageId) {
    appConditions.push(`a."stageId" = $${paramIndex}`);
    params.push(stageId);
    paramIndex++;
  }
  if (status) {
    appConditions.push(`a.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }
  if (jobId) {
    appConditions.push(`a."jobId" = $${paramIndex}`);
    params.push(jobId);
    paramIndex++;
  }
  if (appliedAfter) {
    appConditions.push(`a."createdAt" >= $${paramIndex}`);
    params.push(new Date(appliedAfter));
    paramIndex++;
  }
  if (appliedBefore) {
    appConditions.push(`a."createdAt" <= $${paramIndex}`);
    params.push(new Date(appliedBefore));
    paramIndex++;
  }

  // Market access filter
  if (access.marketIds && access.marketIds.length > 0) {
    appConditions.push(`j."marketId" = ANY($${paramIndex})`);
    params.push(access.marketIds);
    paramIndex++;
  }

  // Check if we need joins based on parsed query or filters
  const needsJoins = parsed.joins.application || parsed.joins.stage || parsed.joins.job ||
    hasApplications === 'true' || appConditions.length > 0;

  // Has applications filter
  if (needsJoins || hasApplications === 'true' || appConditions.length > 0) {
    const appWhere = appConditions.length > 0 ? `AND ${appConditions.join(' AND ')}` : '';
    conditions.push(`EXISTS (
      SELECT 1 FROM "Application" a
      JOIN "Job" j ON a."jobId" = j.id
      ${parsed.joins.stage ? 'JOIN "Stage" s ON a."stageId" = s.id' : ''}
      WHERE a."candidateId" = c.id ${appWhere}
    )`);
  } else if (hasApplications === 'false') {
    conditions.push(`NOT EXISTS (SELECT 1 FROM "Application" WHERE "candidateId" = c.id)`);
  }

  // If no conditions, add a default true condition
  if (conditions.length === 0) {
    conditions.push('TRUE');
  }

  // Build ORDER BY clause
  let orderClause: string;
  if (sortBy === 'relevance' && parsed.sql.tsQuery) {
    // Find the parameter index for the tsQuery
    const tsQueryParamIndex = params.indexOf(parsed.sql.tsQuery) + 1;
    orderClause = `ts_rank(c."searchVector", to_tsquery('english', $${tsQueryParamIndex})) DESC`;
  } else if (sortBy === 'createdAt') {
    orderClause = `c."createdAt" DESC`;
  } else {
    orderClause = `c."updatedAt" DESC`;
  }

  // Count query for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM "Candidate" c
    WHERE ${conditions.join(' AND ')}
  `;

  const countResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params);
  const total = Number(countResult[0]?.total || 0);

  // Build rank expression for SELECT
  const rankExpr = parsed.sql.tsQuery
    ? `ts_rank(c."searchVector", to_tsquery('english', $${params.indexOf(parsed.sql.tsQuery) + 1})) as rank`
    : '0 as rank';

  const query = `
    SELECT
      c.id,
      c."firstName",
      c."lastName",
      c.email,
      c.phone,
      c.city,
      c.state,
      c.country,
      c."resumeUrl",
      c."linkedinUrl",
      c."portfolioUrl",
      c.tags,
      c.source,
      c."createdAt",
      c."updatedAt",
      c."greenhouseCandidateId",
      ${rankExpr}
    FROM "Candidate" c
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderClause}
    LIMIT ${limit}
    OFFSET ${skip}
  `;

  const candidates = await prisma.$queryRawUnsafe<any[]>(query, ...params);

  // Fetch application counts and details for each candidate
  const candidateIds = candidates.map((c) => c.id);

  if (candidateIds.length === 0) {
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      candidates: [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      searchInfo: {
        explanation: parsed.explanation,
        isValid: parsed.isValid,
        errors: parsed.errors,
      },
    });
  }

  const applicationCounts = await prisma.application.groupBy({
    by: ['candidateId'],
    where: { candidateId: { in: candidateIds } },
    _count: { id: true },
  });

  const applications = await prisma.application.findMany({
    where: { candidateId: { in: candidateIds } },
    select: {
      id: true,
      candidateId: true,
      status: true,
      createdAt: true,
      job: {
        select: {
          id: true,
          title: true,
          market: { select: { name: true } },
        },
      },
      stage: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ candidateId: 'asc' }, { updatedAt: 'desc' }],
    take: candidateIds.length * 5,
  });

  // Map counts and applications to candidates
  const countMap = new Map(applicationCounts.map((c) => [c.candidateId, c._count.id]));
  const appMap = new Map<string, any[]>();
  for (const app of applications) {
    if (!appMap.has(app.candidateId)) appMap.set(app.candidateId, []);
    const apps = appMap.get(app.candidateId)!;
    if (apps.length < 5) {
      apps.push({
        id: app.id,
        status: app.status,
        createdAt: app.createdAt,
        job: app.job,
        stage: app.stage,
      });
    }
  }

  const enrichedCandidates = candidates.map((c) => ({
    ...c,
    _count: { applications: countMap.get(c.id) || 0 },
    applications: appMap.get(c.id) || [],
  }));

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    candidates: enrichedCandidates,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    searchInfo: {
      explanation: parsed.explanation,
      isValid: parsed.isValid,
      errors: parsed.errors,
    },
  });
}
