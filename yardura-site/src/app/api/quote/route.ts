import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { validateFormSubmission, logSuspiciousActivity } from '@/lib/formProtection';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Form protection validation
    const protectionResult = await validateFormSubmission(body, req, 'quote');

    if (!protectionResult.isValid) {
      // Log suspicious activity
      if (protectionResult.metadata?.suspiciousActivity) {
        logSuspiciousActivity(body, protectionResult.metadata, 'quote');
      }

      return NextResponse.json(
        {
          ok: false,
          errors: protectionResult.errors,
          metadata: {
            rateLimited: protectionResult.metadata?.rateLimited,
            suspiciousActivity: protectionResult.metadata?.suspiciousActivity,
          },
        },
        {
          status: protectionResult.metadata?.rateLimited ? 429 : 400,
        }
      );
    }

    // Basic validation
    if (!body?.contact?.email || !body?.contact?.name) {
      return NextResponse.json(
        {
          ok: false,
          errors: ['Email and name are required'],
        },
        { status: 400 }
      );
    }

    // Send notification email
    if (resend) {
      const envTo = process.env.CONTACT_TO_EMAIL || 'ayden@yardura.com,austyn@yardura.com';
      const recipients = envTo
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      const quoteData = {
        ...body,
        submittedAt: new Date().toISOString(),
        protectionScore: protectionResult.score,
        ipAddress: protectionResult.metadata?.ip,
      };

      await resend.emails.send({
        from: 'Yardura <notifications@yardura.com>',
        to: recipients,
        subject: `New Quote Request from ${body.contact.name}`,
        replyTo: body.contact.email,
        text: JSON.stringify(quoteData, null, 2),
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Quote submitted successfully',
      protectionScore: protectionResult.score,
    });
  } catch (e) {
    console.error('Quote submission error:', e);
    return NextResponse.json(
      {
        ok: false,
        errors: ['Internal server error. Please try again.'],
      },
      { status: 500 }
    );
  }
}
