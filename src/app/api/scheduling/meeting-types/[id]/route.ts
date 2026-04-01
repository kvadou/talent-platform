import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MeetingLocationType } from '@prisma/client';

// GET /api/scheduling/meeting-types/[id] - Get a single meeting type
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const meetingType = await prisma.meetingType.findUnique({
      where: { id },
    });

    if (!meetingType) {
      return NextResponse.json({ error: 'Meeting type not found' }, { status: 404 });
    }

    if (meetingType.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(meetingType);
  } catch (error) {
    console.error('Failed to fetch meeting type:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting type' }, { status: 500 });
  }
}

// PUT /api/scheduling/meeting-types/[id] - Update a meeting type
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existing = await prisma.meetingType.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Meeting type not found' }, { status: 404 });
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();

    // Check if new slug conflicts with another meeting type
    if (data.slug && data.slug !== existing.slug) {
      const slugConflict = await prisma.meetingType.findUnique({
        where: {
          userId_slug: {
            userId: user.id,
            slug: data.slug,
          },
        },
      });

      if (slugConflict) {
        return NextResponse.json({ error: 'A meeting type with this slug already exists' }, { status: 400 });
      }
    }

    const meetingType = await prisma.meetingType.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        duration: data.duration,
        color: data.color,
        isActive: data.isActive,
        locationType: data.locationType as MeetingLocationType,
        locationDetails: data.locationDetails || null,
        googleMeetEnabled: data.googleMeetEnabled,
        zoomEnabled: data.zoomEnabled,
        zoomLink: data.zoomLink || null,
        bufferBefore: data.bufferBefore,
        bufferAfter: data.bufferAfter,
        minNoticeHours: data.minNoticeHours,
        maxDaysOut: data.maxDaysOut,
        slotIncrement: data.slotIncrement,
        maxPerDay: data.maxPerDay || null,
        maxPerWeek: data.maxPerWeek || null,
        maxPerMonth: data.maxPerMonth || null,
        customQuestions: data.customQuestions || null,
      },
    });

    return NextResponse.json(meetingType);
  } catch (error) {
    console.error('Failed to update meeting type:', error);
    return NextResponse.json({ error: 'Failed to update meeting type' }, { status: 500 });
  }
}

// DELETE /api/scheduling/meeting-types/[id] - Delete a meeting type
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const meetingType = await prisma.meetingType.findUnique({
      where: { id },
    });

    if (!meetingType) {
      return NextResponse.json({ error: 'Meeting type not found' }, { status: 404 });
    }

    if (meetingType.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.meetingType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete meeting type:', error);
    return NextResponse.json({ error: 'Failed to delete meeting type' }, { status: 500 });
  }
}
