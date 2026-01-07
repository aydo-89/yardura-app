import { NextResponse } from 'next/server';

import { STOOL_LIBRARY_ENTRIES } from '@/data/stool-library';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      entries: STOOL_LIBRARY_ENTRIES,
    },
  });
}
