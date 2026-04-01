import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listZoomUsers } from '@/lib/zoom';

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await listZoomUsers();
    
    // Return simplified user list for selection
    const userList = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.display_name || `${user.first_name} ${user.last_name}`,
      status: user.status,
    }));

    return NextResponse.json({ users: userList });
  } catch (error) {
    console.error('Failed to fetch Zoom users:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch Zoom users',
      },
      { status: 500 }
    );
  }
}

