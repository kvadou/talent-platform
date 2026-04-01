import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: {
    username: string;
    meetingSlug: string;
  };
}

/**
 * GET /api/schedule/[username]/[meetingSlug]
 * Get meeting type and user data for public booking page
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { username, meetingSlug } = await params;

  // Find user by scheduling username
  const user = await prisma.user.findUnique({
    where: { schedulingUsername: username },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      timezone: true,
      profileImageUrl: true,
      organization: {
        select: { name: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Find meeting type by slug for this user
  const meetingType = await prisma.meetingType.findFirst({
    where: {
      userId: user.id,
      slug: meetingSlug,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      duration: true,
      color: true,
      locationType: true,
      locationDetails: true,
      googleMeetEnabled: true,
      zoomEnabled: true,
      minNoticeHours: true,
      maxDaysOut: true,
      slotIncrement: true,
      bufferBefore: true,
      bufferAfter: true,
      customQuestions: true,
    },
  });

  if (!meetingType) {
    return NextResponse.json({ error: 'Meeting type not found' }, { status: 404 });
  }

  return NextResponse.json({
    meetingType,
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      timezone: user.timezone,
      profileImageUrl: user.profileImageUrl,
      organizationName: user.organization?.name,
    },
  });
}
