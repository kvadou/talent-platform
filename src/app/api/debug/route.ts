import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DEMO_MODE: process.env.DEMO_MODE,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
    NODE_ENV: process.env.NODE_ENV,
  });
}
