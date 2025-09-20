import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only allow god mode users
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email !== 'ayden@yardura.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: userId } = await params;

    // Update user to admin role
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role: 'ADMIN',
        orgId: 'yardura',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error promoting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
