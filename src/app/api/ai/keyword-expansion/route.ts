import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateKeywordExpansions } from '@/lib/openai';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { keyword, jobTitle, jobDescription } = body;

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: 'keyword is required and must be a string' },
        { status: 400 }
      );
    }

    const expansions = await generateKeywordExpansions(keyword.trim(), {
      jobTitle,
      jobDescription,
    });

    return NextResponse.json({ keyword: keyword.trim(), expansions });
  } catch (err) {
    console.error('Keyword expansion error:', err);
    return NextResponse.json(
      { error: 'Failed to generate keyword expansions' },
      { status: 500 }
    );
  }
}
