import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Serve the logo as a static asset with proper caching
export async function GET() {
  try {
    // Try transparent version first, fall back to regular
    let logoPath = join(process.cwd(), 'public', 'logo-transparent.png');
    let logoBuffer: Buffer;

    try {
      logoBuffer = readFileSync(logoPath);
    } catch {
      logoPath = join(process.cwd(), 'public', 'logo.png');
      logoBuffer = readFileSync(logoPath);
    }

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(logoBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Logo error:', error);
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
  }
}
