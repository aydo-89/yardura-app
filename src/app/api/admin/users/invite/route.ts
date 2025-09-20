import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    // Only allow god mode users
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email !== 'ayden@yardura.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { email, name, role = 'ADMIN', orgId = 'yardura' } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        role,
        orgId,
      },
    });

    // Generate a temporary password (they'll use magic link)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

    // Create an account record for credentials login
    await prisma.account.create({
      data: {
        userId: user.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: user.id,
      },
    });

    // Send invitation email
    const inviteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/signin?email=${encodeURIComponent(email)}`;

    try {
      await resend.emails.send({
        from: 'Yardura <noreply@yardura.com>',
        to: email,
        subject: 'Welcome to Yardura Service OS - Account Setup',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Welcome to Yardura Service OS</h1>

            <p>Hello ${name || 'there'},</p>

            <p>Your Yardura Service OS account has been created! As a ${role.toLowerCase()} user, you now have access to:</p>

            <ul>
              ${role === 'ADMIN' ? `
                <li>Business configuration and pricing management</li>
                <li>Lead management and customer tracking</li>
                <li>Service area management</li>
                <li>Analytics and reporting</li>
              ` : `
                <li>Customer dashboard and service tracking</li>
                <li>Service history and scheduling</li>
              `}
            </ul>

            <p><strong>To get started:</strong></p>
            <ol>
              <li>Click the link below to sign in</li>
              <li>You'll receive a magic link via email</li>
              <li>Complete your profile setup</li>
              ${role === 'ADMIN' ? '<li>Configure your business settings</li>' : ''}
            </ol>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <a href="${inviteUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign In to Your Account</a>
            </div>

            <p><strong>Temporary Credentials:</strong></p>
            <p>Email: ${email}</p>
            <p>Temporary Password: ${tempPassword}</p>

            <p style="color: #dc2626; font-weight: bold;">
              ⚠️ Important: Change your password after first login for security.
            </p>

            <p>If you have any questions, please contact support.</p>

            <p>Best regards,<br>The Yardura Team</p>
          </div>
        `,
      });

      console.log(`Invitation email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the whole request if email fails
    }

    return NextResponse.json({
      ...user,
      inviteSent: true,
      tempPassword: tempPassword // Only return in development
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating user with invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

