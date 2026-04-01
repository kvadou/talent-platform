import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Client } from 'pg';

/**
 * GET /api/integrations/contractor-export
 *
 * Returns list of hired candidates pending export to contractors.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();

  // Check if user is HQ_ADMIN
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  if (user?.role !== 'HQ_ADMIN') {
    return NextResponse.json({ error: 'Forbidden - HQ Admin only' }, { status: 403 });
  }

  // Get pending exports
  const pendingExports = await prisma.application.findMany({
    where: {
      status: 'HIRED',
      candidate: { importedToContractors: false },
    },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          importedToContractors: true,
          contractorId: true,
        },
      },
      job: {
        select: {
          title: true,
          market: { select: { name: true } },
        },
      },
    },
  });

  // Get recently exported
  const recentlyExported = await prisma.candidate.findMany({
    where: {
      importedToContractors: true,
      importedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      contractorId: true,
      importedAt: true,
    },
    orderBy: { importedAt: 'desc' },
    take: 10,
  });

  return NextResponse.json({
    configured: !!process.env.MAIN_APP_DATABASE_URL,
    pendingCount: pendingExports.length,
    pending: pendingExports.map((app) => ({
      applicationId: app.id,
      candidate: app.candidate,
      job: app.job,
    })),
    recentlyExported,
  });
}

/**
 * POST /api/integrations/contractor-export
 *
 * Trigger contractor export for hired candidates.
 * Can specify applicationId to export a single candidate.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();

  // Check if user is HQ_ADMIN
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (user?.role !== 'HQ_ADMIN') {
    return NextResponse.json({ error: 'Forbidden - HQ Admin only' }, { status: 403 });
  }

  if (!process.env.MAIN_APP_DATABASE_URL) {
    return NextResponse.json(
      { error: 'MAIN_APP_DATABASE_URL not configured' },
      { status: 503 }
    );
  }

  // Parse optional applicationId
  const body = await req.json().catch(() => ({}));
  const { applicationId } = body as { applicationId?: string };

  // Get applications to export
  const applications = await prisma.application.findMany({
    where: {
      status: 'HIRED',
      candidate: { importedToContractors: false },
      ...(applicationId ? { id: applicationId } : {}),
    },
    include: { candidate: true },
  });

  if (applications.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No candidates to export',
      exported: 0,
    });
  }

  const client = new Client({ connectionString: process.env.MAIN_APP_DATABASE_URL });
  await client.connect();

  const results: Array<{ candidateId: string; success: boolean; contractorId?: number; error?: string }> = [];

  try {
    for (const app of applications) {
      try {
        const contractor = mapCandidateToContractor(app.candidate, app);
        const query = buildUpsertQuery();

        const values = [
          contractor.first_name,
          contractor.last_name,
          contractor.email,
          contractor.mobile,
          contractor.phone,
          contractor.street,
          contractor.state,
          contractor.town,
          contractor.country,
          contractor.postcode,
          contractor.timezone,
          contractor.status,
          contractor.labels,
          contractor.extra_attrs,
        ];

        const result = await client.query(query, values);
        const contractorId = result.rows[0]?.contractor_id;

        await prisma.candidate.update({
          where: { id: app.candidateId },
          data: {
            importedToContractors: true,
            contractorId,
            importedAt: new Date(),
          },
        });

        await prisma.activityLog.create({
          data: {
            applicationId: app.id,
            candidateId: app.candidateId,
            type: 'STAGE_CHANGE',
            title: 'Exported to contractors',
            description: 'Candidate record created in STT contractors system',
            metadata: { contractorId },
            userId: user.id,
          },
        });

        results.push({
          candidateId: app.candidateId,
          success: true,
          contractorId,
        });
      } catch (err) {
        results.push({
          candidateId: app.candidateId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  } finally {
    await client.end();
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: failCount === 0,
    message: 'Exported ' + successCount + ' of ' + applications.length + ' candidates',
    exported: successCount,
    failed: failCount,
    results,
  });
}

function mapCandidateToContractor(candidate: any, application: any) {
  return {
    first_name: candidate.firstName,
    last_name: candidate.lastName,
    email: candidate.email,
    mobile: candidate.phone,
    phone: candidate.phone,
    street: candidate.street,
    state: candidate.state,
    town: candidate.city,
    country: candidate.country ?? 'United States',
    postcode: candidate.postcode,
    timezone: candidate.timezone,
    status: application.status === 'HIRED' ? 'approved' : 'pending',
    labels: JSON.stringify(candidate.tags ?? []),
    extra_attrs: JSON.stringify({
      source: 'ATS',
      application_id: application.id,
      hired_date: application.updatedAt,
    }),
  };
}

function buildUpsertQuery() {
  return 'INSERT INTO contractors (first_name, last_name, email, mobile, phone, street, state, town, country, postcode, timezone, status, labels, extra_attrs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, mobile = EXCLUDED.mobile, phone = EXCLUDED.phone, street = EXCLUDED.street, state = EXCLUDED.state, town = EXCLUDED.town, country = EXCLUDED.country, postcode = EXCLUDED.postcode, timezone = EXCLUDED.timezone, status = EXCLUDED.status, labels = EXCLUDED.labels, extra_attrs = EXCLUDED.extra_attrs RETURNING contractor_id;';
}
