import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/env";

interface CreateMagicLinkOptions {
  email: string;
  callbackUrl?: string;
  expiresInMs?: number;
}

const DEFAULT_CALLBACK = "/dashboard";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createMagicLink({
  email,
  callbackUrl = DEFAULT_CALLBACK,
  expiresInMs = DEFAULT_TTL_MS,
}: CreateMagicLinkOptions): Promise<string> {
  if (!email) {
    throw new Error("Email is required to create a magic link");
  }

  const normalizedEmail = email.trim().toLowerCase();

  await prisma.verificationToken.deleteMany({
    where: { identifier: normalizedEmail },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + expiresInMs);

  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      expires,
    },
  });

  const baseUrl = getSiteUrl();
  const url = new URL("/auth/verify-magic-link", baseUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("email", normalizedEmail);
  url.searchParams.set("callbackUrl", callbackUrl || DEFAULT_CALLBACK);

  return url.toString();
}
