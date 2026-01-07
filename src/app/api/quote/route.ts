import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  validateFormSubmission,
  logSuspiciousActivity,
} from "@/lib/formProtection";
import { prisma } from "@/lib/prisma";
import { resolveTileByZipCode } from "@/lib/marketplace/tile-map";
import { buildUserRoleFilter } from "@/lib/auth/role-filters";
import { UserRole } from "@prisma/client";
import { sendSalesLeadAssignedPush } from "@/lib/notifications/push";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const formatCurrency = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `$${(value / 100).toFixed(2)}`;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Get business ID from body or query params (supports tenant/org aliases)
    const url = new URL(req.url);
    const businessId =
      body.businessId ||
      url.searchParams.get("businessId") ||
      url.searchParams.get("org") ||
      url.searchParams.get("tenant") ||
      url.searchParams.get("tenantId") ||
      "yardura";

    // Skip form protection for now to allow onboarding flow to work
    // TODO: Re-enable with proper reCAPTCHA setup
    /*
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
    */

    // Basic validation - check for email in either location
    const email = body?.email || body?.contact?.email;
    const firstName = body?.firstName || body?.contact?.name || "Customer";

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          errors: ["Email is required"],
        },
        { status: 400 },
      );
    }

    let validatedSalesRepId: string | null = null;
    if (body?.salesRepId) {
      try {
        const rep = await prisma.user.findFirst({
          where: {
            id: body.salesRepId,
            orgId: businessId,
            ...buildUserRoleFilter([UserRole.SALES_REP]),
          },
          select: { id: true },
        });
        if (rep) {
          validatedSalesRepId = rep.id;
        }
      } catch (error) {
        console.warn(
          "quote: unable to validate sales rep",
          body.salesRepId,
          error,
        );
      }
    }

    const duplicateLeadRecord = await prisma.lead.findFirst({
      where: {
        email,
        orgId: businessId,
        status: {
          not: "WON",
        },
      },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        submittedAt: true,
        status: true,
        frequency: true,
      },
    });

    const phoneForConsent = body?.phone || body?.contact?.phone || null;
    const legacySmsConsent =
      typeof body?.smsConsent === "boolean" ? body.smsConsent : undefined;
    const legacyEmailMarketingConsent =
      typeof body?.emailMarketingConsent === "boolean"
        ? body.emailMarketingConsent
        : undefined;
    const explicitEmailConsent =
      typeof body?.emailConsent === "boolean" ? body.emailConsent : undefined;
    const marketingOptInSource =
      body?.consent?.marketingOptIn ??
      legacySmsConsent ??
      legacyEmailMarketingConsent;

    const marketingOptIn =
      typeof marketingOptInSource === "boolean"
        ? marketingOptInSource
        : Boolean(phoneForConsent);

    const resolvedSmsOptIn =
      (legacySmsConsent ?? marketingOptIn) && Boolean(phoneForConsent);
    const resolvedEmailOptIn =
      (explicitEmailConsent ?? marketingOptIn) && Boolean(email);

    const resolvedZipCodeRaw = body.zipCode || body.addressMeta?.postalCode;
    const resolvedZipCode =
      typeof resolvedZipCodeRaw === "string" || typeof resolvedZipCodeRaw === "number"
        ? String(resolvedZipCodeRaw)
        : null;
    let activeTileSlug: string | null = null;

    if (resolvedZipCode) {
      try {
        const tile = await resolveTileByZipCode(businessId, resolvedZipCode);
        if (tile?.status === "LIVE") {
          activeTileSlug = tile.slug;
        }
      } catch (error) {
        console.warn("quote: unable to resolve tile by ZIP", {
          businessId,
          zipCode: resolvedZipCode,
          error,
        });
      }
    }

    // Create lead record
    let lead;
    try {
      lead = await prisma.lead.create({
        data: {
          orgId: businessId,
          // Contact information
          firstName: firstName,
          lastName: body?.lastName || "",
          email: email,
          phone: body?.phone || body?.contact?.phone,

          // Service details
          serviceType: body.serviceType || body.propertyType || "residential",
          dogs: body.dogs,
          yardSize: body.yardSize,
          frequency: body.frequency,

          // Address information
          address: body.address,
          city: body.addressMeta?.city,
          state: body.addressMeta?.state,
          zipCode: resolvedZipCode,
          latitude: body.addressMeta?.latitude,
          longitude: body.addressMeta?.longitude,

          // Business details (for commercial)
          businessType: body.businessType,
          businessName: body.businessName,

          // Add-ons and services
          deodorize: body.addOns?.deodorize || false,
          deodorizeMode: body.addOns?.deodorizeMode,
          sprayDeck: body.addOns?.sprayDeck || false,
          sprayDeckMode: body.addOns?.sprayDeckMode,
          divertMode: body.addOns?.divertMode,

          // Additional areas to clean
          areasToClean: body.areasToClean
            ? JSON.stringify(body.areasToClean)
            : undefined,

          // Cleanup timing
          lastCleanedBucket: body.lastCleanedBucket,
          lastCleanedDate: body.lastCleanedDate
            ? new Date(body.lastCleanedDate)
            : null,
          initialClean: body.initialClean || false,
          daysSinceLastCleanup: body.daysSinceLastCleanup,

          // Preferences and special requests
          specialInstructions: body.specialInstructions,
          referralSource: body.referralSource || body.howDidYouHear,
          preferredContactMethod:
            body.preferredContactMethod ||
            (Array.isArray(body.preferredContactMethods)
              ? body.preferredContactMethods[0]
              : undefined),

          salesRepId: validatedSalesRepId,
          ownerId: validatedSalesRepId ?? undefined,

          // Wellness insights consent
          wellnessOptIn: body.consent?.stoolPhotosOptIn || false,

          // Form protection and analytics (temporarily disabled)
          protectionScore: 0, // Default score when protection is skipped
          ipAddress:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            req.headers.get("cf-connecting-ip") ||
            req.headers.get("x-client-ip") ||
            "unknown",
          userAgent: req.headers.get("user-agent"),
          recaptchaToken: body.recaptchaToken,

          // Pricing snapshot
          estimatedPrice:
            typeof body.pricingSnapshot?.total === "number"
              ? body.pricingSnapshot.total
              : typeof body.pricingSnapshot?.monthly === "number"
                ? body.pricingSnapshot.monthly
                : undefined,
          pricingBreakdown: (() => {
            const metadata = {
              preferredStartDate: body.preferredStartDate || null,
              preferredContactMethods: Array.isArray(
                body.preferredContactMethods,
              )
                ? body.preferredContactMethods
                : null,
              howDidYouHear: body.howDidYouHear || body.referralSource || null,
              salesRepId: validatedSalesRepId,
              salesRepName: body.salesRepName || null,
              specialRequests: body.specialInstructions || null,
              quoteSessionId:
                typeof body.quoteSessionId === "string"
                  ? body.quoteSessionId
                  : null,
              marketingOptIn,
              weekendUpgrade: Boolean(body.weekendUpgrade),
              ...(activeTileSlug ? { serviceTileSlug: activeTileSlug } : {}),
            };

            if (body.pricingSnapshot) {
              return {
                ...body.pricingSnapshot,
                metadata,
              };
            }

            return { metadata };
          })(),
        },
      });
    } catch (error) {
      console.error("Failed to create lead:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("Error details:", errorMessage);
      if (errorStack) console.error("Error stack:", errorStack);
      return NextResponse.json(
        {
          ok: false,
          errors: [`Failed to process quote: ${errorMessage}`],
        },
        { status: 500 },
      );
    }

    if (validatedSalesRepId) {
      const customerName = [body?.firstName, body?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      void sendSalesLeadAssignedPush({
        userId: validatedSalesRepId,
        customerName: customerName || null,
        city: body.addressMeta?.city ?? body.city ?? null,
        state: body.addressMeta?.state ?? body.state ?? null,
      }).catch(() => null);
    }

    // Send notification email
    if (resend) {
      const displayFirstName =
        body.firstName || body.contact?.name?.split(" ")?.[0] || "Customer";
      const displayLastName =
        body.lastName || body.contact?.name?.split(" ")?.slice(1).join(" ");
      const displayName =
        [displayFirstName, displayLastName].filter(Boolean).join(" ").trim() ||
        "Customer";
      const contactEmail = body.email || body.contact?.email || "N/A";
      const contactPhone = body.phone || body.contact?.phone || "N/A";
      const locationLine =
        body.address ||
        [
          body.addressMeta?.city,
          body.addressMeta?.state,
          body.zipCode || body.addressMeta?.postalCode,
        ]
          .filter(Boolean)
          .join(", ") ||
        "Not provided";
      const serviceSummary = `${body.serviceType || body.propertyType || "residential"} • ${body.frequency || "n/a"} • ${body.yardSize || "n/a"} yard`;
      const pricing = body.pricingSnapshot || {};
      const salesRepLabel = body.salesRepName || body.salesRepId || "";

      const envTo =
        process.env.CONTACT_TO_EMAIL || "ayden@yardura.com,austyn@yardura.com";
      const recipients = envTo
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const quoteData = {
        ...body,
        leadId: lead.id,
        submittedAt: new Date().toISOString(),
        protectionScore: 0, // Default score when protection is skipped
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          req.headers.get("cf-connecting-ip") ||
          req.headers.get("x-client-ip") ||
          "unknown",
      };

      const safeJson = JSON.stringify(quoteData, null, 2).replace(/</g, "&lt;");
      const monthlyPrice = formatCurrency(pricing?.monthly);
      const perVisitPrice = formatCurrency(pricing?.perVisit);
      const initialVisitPrice = formatCurrency(
        pricing?.initialClean ?? pricing?.oneTime,
      );

      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <div style="padding: 24px 0; border-bottom: 1px solid #e5e7eb;">
            <h1 style="margin: 0; font-size: 24px;">New Quote Submitted</h1>
            <p style="margin: 6px 0 0; font-size: 14px; color: #6b7280;">Lead ID: <code>${lead.id}</code></p>
          </div>

          <table style="width: 100%; border-spacing: 0; margin: 24px 0;">
            <tbody>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; width: 160px;">Customer</td>
                <td style="padding: 8px 0;">${displayName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Email</td>
                <td style="padding: 8px 0;"><a href="mailto:${contactEmail}" style="color: #2563eb; text-decoration: none;">${contactEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Phone</td>
                <td style="padding: 8px 0;">${contactPhone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Service</td>
                <td style="padding: 8px 0; text-transform: capitalize;">${serviceSummary}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Address</td>
                <td style="padding: 8px 0;">${locationLine}</td>
              </tr>
              ${
                salesRepLabel
                  ? `<tr>
                <td style="padding: 8px 0; font-weight: 600;">Sales Rep</td>
                <td style="padding: 8px 0;">${salesRepLabel}</td>
              </tr>`
                  : ""
              }
            </tbody>
          </table>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 12px; font-size: 16px;">Pricing Snapshot</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px;">
              <div>
                <div style="color: #6b7280; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em;">Monthly</div>
                <strong style="font-size: 18px;">${monthlyPrice}</strong>
              </div>
              <div>
                <div style="color: #6b7280; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em;">Per Visit</div>
                <strong style="font-size: 18px;">${perVisitPrice}</strong>
              </div>
              <div>
                <div style="color: #6b7280; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em;">Initial Visit</div>
                <strong style="font-size: 18px;">${initialVisitPrice}</strong>
              </div>
            </div>
          </div>

          <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px;">
            <p style="margin: 0 0 8px; font-weight: 600;">Raw Submission (JSON)</p>
            <pre style="margin: 0; padding: 12px; background: #0f172a; color: #f8fafc; border-radius: 8px; font-size: 12px; overflow-x: auto;">${safeJson}</pre>
          </div>
        </div>
      `;

      const text = [
        "New Quote Submitted",
        `Lead ID: ${lead.id}`,
        `Customer: ${displayName}`,
        `Email: ${contactEmail}`,
        `Phone: ${contactPhone}`,
        `Address: ${locationLine}`,
        `Service: ${serviceSummary}`,
        `Monthly: ${monthlyPrice}`,
        `Per Visit: ${perVisitPrice}`,
        `Initial Visit: ${initialVisitPrice}`,
        salesRepLabel ? `Sales Rep: ${salesRepLabel}` : "",
        "",
        JSON.stringify(quoteData, null, 2),
      ].join("\n");

      await resend.emails.send({
        from: "InsightScoop <notifications@yardura.com>",
        to: recipients,
        subject: `New Quote Request from ${displayName}`,
        replyTo: contactEmail !== "N/A" ? contactEmail : undefined,
        html,
        text,
      });
    }

    const duplicateLeadInfo =
      duplicateLeadRecord && duplicateLeadRecord.id !== lead.id
        ? {
            id: duplicateLeadRecord.id,
            submittedAt: duplicateLeadRecord.submittedAt
              ? duplicateLeadRecord.submittedAt.toISOString()
              : null,
            status: duplicateLeadRecord.status
              ? String(duplicateLeadRecord.status)
              : null,
            frequency: duplicateLeadRecord.frequency ?? null,
          }
        : null;

    return NextResponse.json({
      ok: true,
      message: "Quote submitted successfully",
      leadId: lead.id,
      protectionScore: 0, // Default score when protection is skipped
      duplicateLead: duplicateLeadInfo,
    });
  } catch (e) {
    console.error("Quote submission error:", e);
    return NextResponse.json(
      {
        ok: false,
        errors: ["Internal server error. Please try again."],
      },
      { status: 500 },
    );
  }
}
