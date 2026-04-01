import { Client } from 'pg';
import { prisma } from '@/lib/prisma';

/**
 * Maps a candidate and application to contractor format for STT database
 */
export function mapCandidateToContractor(candidate: any, application: any) {
  return {
    contractor_id: candidate.contractorId ?? undefined,
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
    extra_attrs: JSON.stringify({ source: 'ATS', application_id: application.id, hired_date: application.updatedAt || new Date() })
  };
}

/**
 * SQL query for upserting a contractor
 */
export const UPSERT_CONTRACTOR_QUERY = `
  INSERT INTO contractors (first_name, last_name, email, mobile, phone, street, state, town, country, postcode, timezone, status, labels, extra_attrs)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
  ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    mobile = EXCLUDED.mobile,
    phone = EXCLUDED.phone,
    street = EXCLUDED.street,
    state = EXCLUDED.state,
    town = EXCLUDED.town,
    country = EXCLUDED.country,
    postcode = EXCLUDED.postcode,
    timezone = EXCLUDED.timezone,
    status = EXCLUDED.status,
    labels = EXCLUDED.labels,
    extra_attrs = EXCLUDED.extra_attrs
  RETURNING contractor_id;
`;

/**
 * Converts contractor object to array of values for SQL query
 */
export function contractorToValues(contractor: ReturnType<typeof mapCandidateToContractor>) {
  return [
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
    contractor.extra_attrs
  ];
}

/**
 * Export a single candidate to STT contractors database
 * Used by webhooks for real-time export on hire
 */
export async function exportSingleCandidate(applicationId: string): Promise<{ success: boolean; contractorId?: number; error?: string }> {
  if (!process.env.MAIN_APP_DATABASE_URL) {
    return { success: false, error: 'MAIN_APP_DATABASE_URL not configured' };
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: true }
  });

  if (!application || !application.candidate) {
    return { success: false, error: 'Application or candidate not found' };
  }

  if (application.candidate.importedToContractors) {
    return { success: true, contractorId: application.candidate.contractorId || undefined };
  }

  const client = new Client({ connectionString: process.env.MAIN_APP_DATABASE_URL });

  try {
    await client.connect();

    const contractor = mapCandidateToContractor(application.candidate, application);
    const values = contractorToValues(contractor);
    const result = await client.query(UPSERT_CONTRACTOR_QUERY, values);
    const contractorId = result.rows[0]?.contractor_id;

    await prisma.candidate.update({
      where: { id: application.candidateId },
      data: { importedToContractors: true, contractorId, importedAt: new Date() }
    });

    return { success: true, contractorId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    await client.end();
  }
}

/**
 * Export all hired candidates that haven't been exported yet
 * Used by batch scripts and manual triggers
 */
export async function exportHiredCandidates() {
  if (!process.env.MAIN_APP_DATABASE_URL) throw new Error('MAIN_APP_DATABASE_URL missing');
  const client = new Client({ connectionString: process.env.MAIN_APP_DATABASE_URL });
  await client.connect();

  try {
    const applications = await prisma.application.findMany({
      where: { status: 'HIRED', candidate: { importedToContractors: false } },
      include: { candidate: true }
    });

    for (const app of applications) {
      const contractor = mapCandidateToContractor(app.candidate, app);
      const values = contractorToValues(contractor);
      const result = await client.query(UPSERT_CONTRACTOR_QUERY, values);
      const contractorId = result.rows[0]?.contractor_id;

      await prisma.candidate.update({
        where: { id: app.candidateId },
        data: { importedToContractors: true, contractorId, importedAt: new Date() }
      });
    }
  } finally {
    await client.end();
  }
}
