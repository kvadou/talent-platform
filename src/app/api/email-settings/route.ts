import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateEmailSettingsSchema = z.object({
  emailDomain: z.string().optional().nullable(),
  emailFromAddress: z.string().email().optional().nullable(),
  emailReplyToAddress: z.string().email().optional().nullable(),
});

// GET /api/email-settings - Get email settings
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the first organization (single-tenant for now)
    const organization = await prisma.organization.findFirst({
      select: {
        id: true,
        name: true,
        emailDomain: true,
        emailDomainVerified: true,
        emailFromAddress: true,
        emailReplyToAddress: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      settings: {
        domain: organization.emailDomain || '',
        domainVerified: organization.emailDomainVerified,
        fromAddress: organization.emailFromAddress || '',
        replyToAddress: organization.emailReplyToAddress || '',
      },
      organizationName: organization.name,
    });
  } catch (error) {
    console.error('Error fetching email settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email settings' },
      { status: 500 }
    );
  }
}

// PUT /api/email-settings - Update email settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateEmailSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get the first organization
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        emailDomain: parsed.data.emailDomain,
        emailFromAddress: parsed.data.emailFromAddress,
        emailReplyToAddress: parsed.data.emailReplyToAddress,
      },
      select: {
        emailDomain: true,
        emailDomainVerified: true,
        emailFromAddress: true,
        emailReplyToAddress: true,
      },
    });

    return NextResponse.json({
      settings: {
        domain: updated.emailDomain || '',
        domainVerified: updated.emailDomainVerified,
        fromAddress: updated.emailFromAddress || '',
        replyToAddress: updated.emailReplyToAddress || '',
      },
    });
  } catch (error) {
    console.error('Error updating email settings:', error);
    return NextResponse.json(
      { error: 'Failed to update email settings' },
      { status: 500 }
    );
  }
}
