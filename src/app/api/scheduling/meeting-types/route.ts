import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MeetingLocationType } from '@prisma/client';

// GET /api/scheduling/meeting-types - Get all meeting types for current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, organizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const meetingTypes = await prisma.meetingType.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(meetingTypes);
  } catch (error) {
    console.error('Failed to fetch meeting types:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting types' }, { status: 500 });
  }
}

// POST /api/scheduling/meeting-types - Create a new meeting type
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, organizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = await request.json();

    // Check if slug is unique for this user
    const existing = await prisma.meetingType.findUnique({
      where: {
        userId_slug: {
          userId: user.id,
          slug: data.slug,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'A meeting type with this slug already exists' }, { status: 400 });
    }

    const meetingType = await prisma.meetingType.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        duration: data.duration || 30,
        color: data.color || '#3b82f6',
        isActive: data.isActive ?? true,
        locationType: (data.locationType as MeetingLocationType) || 'PHONE',
        locationDetails: data.locationDetails || null,
        googleMeetEnabled: data.googleMeetEnabled ?? false,
        zoomEnabled: data.zoomEnabled ?? false,
        zoomLink: data.zoomLink || null,
        bufferBefore: data.bufferBefore ?? 5,
        bufferAfter: data.bufferAfter ?? 5,
        minNoticeHours: data.minNoticeHours ?? 24,
        maxDaysOut: data.maxDaysOut ?? 30,
        slotIncrement: data.slotIncrement ?? 30,
        maxPerDay: data.maxPerDay || null,
        maxPerWeek: data.maxPerWeek || null,
        maxPerMonth: data.maxPerMonth || null,
        customQuestions: data.customQuestions || null,
      },
    });

    return NextResponse.json(meetingType);
  } catch (error) {
    console.error('Failed to create meeting type:', error);
    return NextResponse.json({ error: 'Failed to create meeting type' }, { status: 500 });
  }
}
