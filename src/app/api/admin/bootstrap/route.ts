import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development or with a special header
    if (process.env.NODE_ENV === 'production' && request.headers.get('x-bootstrap-key') !== process.env.BOOTSTRAP_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, name, orgId = 'yardura', role = 'ADMIN' } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate a secure temporary password
    const tempPassword = Math.random().toString(36).slice(-16) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        role,
        orgId,
        accounts: {
          create: {
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: email,
            access_token: hashedPassword,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
      },
    });

    return NextResponse.json({
      message: 'Admin user created successfully',
      user,
      tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : 'Check server logs',
    });

  } catch (error: any) {
    console.error('Error creating admin user:', error);

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'User already exists with this email' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

