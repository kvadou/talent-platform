import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';
import { createCandidate, createInvitation, isCheckrConfigured, getPackages } from '@/lib/checkr';
import { z } from 'zod';

const createBackgroundCheckSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID required'),
  package: z.string().min(1, 'Package required'),
  workLocation: z.object({
    city: z.string().optional(),
    state: z.string().min(1, 'State required'),
    country: z.string().default('US'),
  }),
});

// GET - List background checks for a candidate or get available packages
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const candidateId = url.searchParams.get('candidateId');
  const action = url.searchParams.get('action');

  // Return available packages
  if (action === 'packages') {
    if (!isCheckrConfigured()) {
      return NextResponse.json({
        packages: [],
        configured: false,
      });
    }

    try {
      // Fetch actual packages from Checkr account
      const checkrPackages = await getPackages();
      const packages = checkrPackages.data.map((pkg) => ({
        slug: pkg.slug,
        name: pkg.name,
        description: pkg.name, // Checkr doesn't provide descriptions
      }));

      return NextResponse.json({
        packages,
        configured: true,
      });
    } catch (error) {
      console.error('Failed to fetch Checkr packages:', error);
      return NextResponse.json({
        packages: [],
        configured: true,
        error: 'Failed to fetch packages from Checkr',
      });
    }
  }

  // Return background checks for a candidate
  if (candidateId) {
    await ensureUser();
    const access = await getUserMarkets(session.user.email);

    // Verify access to candidate
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        ...(access.marketIds
          ? {
              applications: {
                some: { job: { marketId: { in: access.marketIds } } },
              },
            }
          : {}),
      },
      select: {
        id: true,
        backgroundChecks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    return NextResponse.json({
      backgroundChecks: candidate.backgroundChecks,
    });
  }

  return NextResponse.json({ error: 'Missing candidateId parameter' }, { status: 400 });
}

// POST - Initiate a new background check
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isCheckrConfigured()) {
    return NextResponse.json(
      { error: 'Checkr integration not configured. Add CHECKR_API_KEY to environment.' },
      { status: 503 }
    );
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  // Parse request
  const body = await req.json();
  const parseResult = createBackgroundCheckSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { candidateId, package: packageSlug, workLocation } = parseResult.data;

  // Fetch candidate and verify access
  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      ...(access.marketIds
        ? {
            applications: {
              some: { job: { marketId: { in: access.marketIds } } },
            },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      postcode: true,
      backgroundChecks: {
        where: { status: { in: ['pending', 'processing'] } },
        take: 1,
      },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  // Check for existing pending check
  if (candidate.backgroundChecks.length > 0) {
    return NextResponse.json(
      { error: 'A background check is already in progress for this candidate' },
      { status: 409 }
    );
  }

  try {
    // Step 1: Create candidate in Checkr (without DOB/SSN - those will be collected via invitation)
    const checkrCandidate = await createCandidate({
      email: candidate.email,
      first_name: candidate.firstName,
      last_name: candidate.lastName,
      no_middle_name: true,
      phone: candidate.phone || undefined,
    });

    // Step 2: Create invitation - Checkr will email the candidate to collect
    // their sensitive info (DOB, SSN, address) directly
    // Build work location object, only including city if provided (Checkr rejects undefined values)
    const workLocationObj: { country: string; state: string; city?: string } = {
      country: workLocation.country,
      state: workLocation.state,
    };
    if (workLocation.city) {
      workLocationObj.city = workLocation.city;
    }

    const invitation = await createInvitation({
      candidate_id: checkrCandidate.id,
      package: packageSlug,
      work_locations: [workLocationObj],
    });

    // Store in our database with invitation status
    const backgroundCheck = await prisma.backgroundCheck.create({
      data: {
        candidateId: candidate.id,
        checkrInvitationId: invitation.id,
        checkrCandidateId: checkrCandidate.id,
        package: packageSlug,
        status: 'invitation_pending', // Will change to "pending" once candidate completes form
      },
    });

    return NextResponse.json({
      success: true,
      backgroundCheck,
      invitationUrl: invitation.invitation_url,
      message: `Background check invitation sent to ${candidate.email}. The candidate will receive an email from Checkr to complete their information.`,
    });
  } catch (error) {
    console.error('Checkr API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate background check' },
      { status: 500 }
    );
  }
}
