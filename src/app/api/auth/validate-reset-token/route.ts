import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database-access';

const prisma = getDb();

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find account with this reset token
    const account = await prisma.account.findFirst({
      where: {
        reset_token: token,
        reset_token_expires: {
          gt: new Date(), // Token hasn't expired
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    // Token is valid
    return NextResponse.json({
      valid: true,
      email: account.user.email,
      name: account.user.name,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'An error occurred while validating the token' },
      { status: 500 }
    );
  }
}
