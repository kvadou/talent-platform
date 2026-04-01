import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/bulk-import/template - Download CSV template
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headers = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'linkedinUrl',
      'portfolioUrl',
      'city',
      'state',
      'country',
      'notes',
      'tags',
    ];

    const sampleData = [
      'John',
      'Doe',
      'john.doe@example.com',
      '+1 (555) 123-4567',
      'https://linkedin.com/in/johndoe',
      'https://johndoe.com',
      'New York',
      'NY',
      'United States',
      'Referred by Jane Smith',
      'experienced|senior',
    ];

    const csv = [
      headers.join(','),
      sampleData.join(','),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="candidate-import-template.csv"',
      },
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
