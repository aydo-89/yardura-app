import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database-access';
import bcrypt from 'bcryptjs';

const prisma = getDb();

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
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

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the account with new password and clear reset token
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: hashedPassword, // Store hashed password in access_token field
        reset_token: null,
        reset_token_expires: null,
      },
    });

    // Optionally, you might want to invalidate all existing sessions for security
    // This would require logging out the user from all devices
    // await prisma.session.deleteMany({
    //   where: { userId: account.user.id },
    // });

    return NextResponse.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'An error occurred while resetting the password' },
      { status: 500 }
    );
  }
}
