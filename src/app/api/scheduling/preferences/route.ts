import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/scheduling/preferences - Get user's scheduling preferences
export async function GET() {
  try {
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

    const preferences = await prisma.schedulingPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      // Return defaults if not set
      return NextResponse.json({
        timezone: 'America/Chicago',
        useCalendly: false,
        calendlyLink: '',
        defaultBufferBefore: 5,
        defaultBufferAfter: 5,
        showTimezoneToInvitee: true,
        autoDetectTimezone: true,
      });
    }

    return NextResponse.json({
      timezone: preferences.timezone,
      useCalendly: preferences.useCalendly,
      calendlyLink: preferences.calendlyLink || '',
      defaultBufferBefore: preferences.defaultBufferBefore,
      defaultBufferAfter: preferences.defaultBufferAfter,
      showTimezoneToInvitee: preferences.showTimezoneToInvitee,
      autoDetectTimezone: preferences.autoDetectTimezone,
    });
  } catch (error) {
    console.error('Failed to fetch preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// POST /api/scheduling/preferences - Save user's scheduling preferences
export async function POST(request: Request) {
  try {
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

    const data = await request.json();

    const preferences = await prisma.schedulingPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        timezone: data.timezone || 'America/Chicago',
        useCalendly: data.useCalendly ?? false,
        calendlyLink: data.calendlyLink || null,
        defaultBufferBefore: data.defaultBufferBefore ?? 5,
        defaultBufferAfter: data.defaultBufferAfter ?? 5,
        showTimezoneToInvitee: data.showTimezoneToInvitee ?? true,
        autoDetectTimezone: data.autoDetectTimezone ?? true,
      },
      update: {
        timezone: data.timezone || 'America/Chicago',
        useCalendly: data.useCalendly ?? false,
        calendlyLink: data.calendlyLink || null,
        defaultBufferBefore: data.defaultBufferBefore ?? 5,
        defaultBufferAfter: data.defaultBufferAfter ?? 5,
        showTimezoneToInvitee: data.showTimezoneToInvitee ?? true,
        autoDetectTimezone: data.autoDetectTimezone ?? true,
      },
    });

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('Failed to save preferences:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
