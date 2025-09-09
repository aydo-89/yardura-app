import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const file = readFileSync(join(process.cwd(), 'public', 'qr-yardura-site.svg'), 'utf8');
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (_e) {
    return new NextResponse('Not Found', { status: 404 });
  }
}
