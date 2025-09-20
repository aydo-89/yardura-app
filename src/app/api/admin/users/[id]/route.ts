import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(
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

    // Prevent deleting the god mode user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.email === 'ayden@yardura.com') {
      return NextResponse.json({ error: 'Cannot delete god mode user' }, { status: 403 });
    }

    // Delete the user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
