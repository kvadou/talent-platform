import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { refineText, type RefineTextAction } from '@/lib/openai';

const VALID_ACTIONS: RefineTextAction[] = ['refine', 'grammar', 'concise', 'detailed'];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { text, action } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'text is required and must be a string' },
        { status: 400 }
      );
    }

    if (text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Text must be at least 10 characters long' },
        { status: 400 }
      );
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const refinedText = await refineText(text.trim(), action as RefineTextAction);

    return NextResponse.json({ refinedText });
  } catch (err) {
    console.error('Text refinement error:', err);
    return NextResponse.json(
      { error: 'Failed to refine text' },
      { status: 500 }
    );
  }
}
