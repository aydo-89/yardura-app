import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/mobile-auth";
import type { AppUserRole } from "@/lib/auth/roles";

const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

const schema = z.object({
  identityToken: z.string().min(1),
  authorizationCode: z.string().min(1),
  email: z.string().email().nullable().optional(),
  fullName: z.string().nullable().optional(),
  user: z.string().min(1), // Apple user ID
});

// JWKS client for Apple's public keys
const client = jwksClient({
  jwksUri: APPLE_JWKS_URL,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getAppleSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!header.kid) {
      reject(new Error("No kid in token header"));
      return;
    }
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        reject(err);
        return;
      }
      const signingKey = key?.getPublicKey();
      if (!signingKey) {
        reject(new Error("Unable to get signing key"));
        return;
      }
      resolve(signingKey);
    });
  });
}

interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string; // Apple user ID
  email?: string;
  email_verified?: string;
  is_private_email?: string;
  auth_time: number;
  nonce_supported: boolean;
}

async function verifyAppleToken(identityToken: string): Promise<AppleTokenPayload> {
  // Decode the token without verification to get the header
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || typeof decoded === "string") {
    throw new Error("Invalid token format");
  }

  // Get the signing key from Apple
  const signingKey = await getAppleSigningKey(decoded.header);

  // Verify the token
  const verified = jwt.verify(identityToken, signingKey, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
    // audience should match your app's bundle identifier
    audience: process.env.APPLE_BUNDLE_ID || "com.yardura.insightscoop.app",
  }) as AppleTokenPayload;

  return verified;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = schema.parse(body);

    // Verify the Apple identity token
    let applePayload: AppleTokenPayload;
    try {
      applePayload = await verifyAppleToken(data.identityToken);
    } catch (verifyError) {
      console.error("[apple-auth] Token verification failed:", verifyError);
      return NextResponse.json(
        { error: "invalid_token", message: "Apple token verification failed" },
        { status: 401 }
      );
    }

    // The sub claim is the stable Apple user ID
    const appleUserId = applePayload.sub;

    // Email might come from token or from the initial sign-in data
    // Apple only provides email on first sign-in
    const email = applePayload.email || data.email;

    // Try to find existing user by Apple ID first
    let user = await prisma.user.findFirst({
      where: { appleId: appleUserId },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        role: true,
        orgId: true,
        customer: { select: { id: true } },
        scooperProfile: { select: { id: true } },
      },
    });

    // If no user found by Apple ID, try to find by email
    if (!user && email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          role: true,
          orgId: true,
          appleId: true,
          customer: { select: { id: true } },
          scooperProfile: { select: { id: true } },
        },
      });

      if (existingUser) {
        // Link Apple ID to existing user if not already linked
        if (!existingUser.appleId) {
          user = await prisma.user.update({
            where: { id: existingUser.id },
            data: { appleId: appleUserId },
            select: {
              id: true,
              email: true,
              name: true,
              roles: true,
              role: true,
              orgId: true,
              customer: { select: { id: true } },
              scooperProfile: { select: { id: true } },
            },
          });
        } else if (existingUser.appleId !== appleUserId) {
          // Different Apple ID trying to use same email
          return NextResponse.json(
            {
              error: "email_linked_to_other_account",
              message: "This email is already linked to a different Apple ID",
            },
            { status: 409 }
          );
        } else {
          user = existingUser;
        }
      }
    }

    // If still no user, create a new one
    if (!user) {
      if (!email) {
        return NextResponse.json(
          {
            error: "email_required",
            message: "Email is required to create an account. Please sign in with Apple again and share your email.",
          },
          { status: 400 }
        );
      }

      // Create new user with CUSTOMER role and default org
      user = await prisma.user.create({
        data: {
          email,
          name: data.fullName || email.split("@")[0],
          appleId: appleUserId,
          role: "CUSTOMER",
          roles: ["CUSTOMER"],
          orgId: "yardura", // Default to yardura org for multi-tenancy
          emailVerified: new Date(), // Apple has verified the email
        },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          role: true,
          orgId: true,
          customer: { select: { id: true } },
          scooperProfile: { select: { id: true } },
        },
      });
    }

    // Update name if provided and user doesn't have one
    if (data.fullName && (!user.name || user.name === user.email?.split("@")[0])) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: data.fullName },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          role: true,
          orgId: true,
          customer: { select: { id: true } },
          scooperProfile: { select: { id: true } },
        },
      });
    }

    // Generate JWT token
    const roles = ((user.roles as string[] | null) ?? [user.role ?? "CUSTOMER"]) as AppUserRole[];
    const activeRole: AppUserRole = roles.includes("CUSTOMER" as AppUserRole)
      ? "CUSTOMER"
      : (roles[0] ?? "CUSTOMER");

    const token = signMobileToken({
      sub: user.id,
      email: user.email ?? "",
      roles,
      activeRole,
    });

    return NextResponse.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        customerId: (user as any).customer?.id ?? null,
        scooperProfileId: (user as any).scooperProfile?.id ?? null,
      },
      roles,
      activeRole,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 }
      );
    }

    console.error("[apple-auth] Error:", error);
    return NextResponse.json(
      { error: "auth_failed", message: "Authentication failed" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
