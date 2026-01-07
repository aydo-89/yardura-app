import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { env, getEmailConfig, getSiteUrl, isAdminEmail } from "./env";
import { normalizeEmail } from "@/lib/auth/email-normalizer";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { AppUserRole } from "@/lib/auth/roles";
import { sortRoles } from "@/lib/auth/roles";

// Get email configuration
const emailConfig = getEmailConfig();

// Import NextAuth components
import NextAuth, { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

// For cookie configuration, always use NEXTAUTH_URL in development
// This ensures localhost cookies work correctly
const resolvedSiteUrl = (() => {
  // In development, prioritize NEXTAUTH_URL for cookie configuration
  if (env.NODE_ENV === "development" && env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL;
  }
  
  try {
    return getSiteUrl();
  } catch (error) {
    console.warn("getSiteUrl failed, falling back to NEXTAUTH_URL for cookies:", error);
    return env.NEXTAUTH_URL || "https://www.getinsightscoop.com";
  }
})();

const parsedSiteUrl = (() => {
  try {
    return new URL(resolvedSiteUrl);
  } catch (error) {
    console.warn("Invalid site URL, cookie domain derivation may be impacted:", error);
    return null;
  }
})();

const hostname = parsedSiteUrl?.hostname;

const isIpAddress = (value: string | undefined) =>
  !!value && /^(\d{1,3}\.){3}\d{1,3}$/.test(value);

const isLocalHostname = (host: string | undefined) =>
  !host ||
  host === "localhost" ||
  host === "127.0.0.1" ||
  host.endsWith(".local") ||
  isIpAddress(host);

const deriveCookieDomain = (host: string | undefined) => {
  if (!host || isLocalHostname(host)) {
    return undefined;
  }

  const parts = host.split(".");
  if (parts.length <= 2) {
    return `.${host}`;
  }

  const publicSuffixes = new Set(["co.uk", "com.au", "co.nz", "com.br"]);
  const lastTwo = parts.slice(-2).join(".");
  if (publicSuffixes.has(lastTwo) && parts.length >= 3) {
    return `.${parts.slice(-3).join(".")}`;
  }

  return `.${lastTwo}`;
};

// IMPORTANT: For localhost, ALWAYS use undefined cookie domain
// regardless of what NEXTAUTH_COOKIE_DOMAIN says in env
const computedCookieDomain = isLocalHostname(hostname)
  ? undefined
  : (env.NEXTAUTH_COOKIE_DOMAIN?.trim() || deriveCookieDomain(hostname));

const shouldUseSecureCookies =
  !isLocalHostname(hostname) &&
  (env.NODE_ENV === "production" || parsedSiteUrl?.protocol === "https:");

// Debug logging for cookie configuration
console.log("[NextAuth Cookie Config]", {
  hostname,
  isLocal: isLocalHostname(hostname),
  computedCookieDomain,
  shouldUseSecureCookies,
  NEXTAUTH_URL: env.NEXTAUTH_URL,
  NODE_ENV: env.NODE_ENV,
});

const providers = [
  // Email provider for magic links (always available)
  EmailProvider({
    server:
      emailConfig.provider === "smtp" && emailConfig.smtp
        ? {
            host: emailConfig.smtp.host,
            port: emailConfig.smtp.port,
            secure: emailConfig.smtp.secure,
            auth: {
              user: emailConfig.smtp.auth.user,
              pass: emailConfig.smtp.auth.pass,
            },
          }
        : undefined,
    from: env.EMAIL_FROM,
    async sendVerificationRequest({ identifier, url }: any) {
      const host = new URL(getSiteUrl()).host;

      const subject = `Your InsightScoop sign-in link`;
      const text = `Hello!\n\nListen, here's the InsightScoop: use the secure link below to hop into your InsightScoop account.\n${url}\n\nIf you didn't request this, you can safely ignore the email. The link expires in 24 hours.`;
      // Brand colors: Coral #F3645B, Evergreen #204B36, Mint #19B4A3, Gold #FFC24D
      // Background: Porcelain #FAF7F1, Text: Graphite #1B1E23
      const html = `
        <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background-color: #FAF7F1;">
          <div style="background:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 24px 48px rgba(27,30,35,0.08);">
            <div style="padding: 32px; background-color: #F3645B; color: #FFFFFF;">
              <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.85;">Account access</p>
              <h1 style="margin:0;font-size:28px;font-family:'Nunito','Segoe UI',Arial,sans-serif;font-weight:700;">Sign in to InsightScoop</h1>
              <p style="margin:12px 0 0;font-size:16px;opacity:0.95;">Your secure one-click sign-in link is ready.</p>
            </div>

            <div style="padding:36px; line-height:1.6; font-size:15px; color:#1B1E23;">
              <p style="margin:0 0 20px;color:#64748B;">Hello there,</p>
              <p style="margin:0 0 24px;color:#64748B;">Tap the button below to securely sign in to your InsightScoop account. No password needed—this magic link handles everything.</p>

              <div style="text-align:center; margin: 28px 0;">
                <a href="${url}" style="display:inline-block; padding:16px 36px; border-radius:999px; background-color:#F3645B; color:#FFFFFF; text-decoration:none; font-weight:600; font-size:16px; box-shadow:0 4px 12px rgba(243,100,91,0.3);">Sign in to InsightScoop</a>
              </div>

              <div style="background-color:#FFF1DA; border:1px solid rgba(255,194,77,0.45); border-radius:18px; padding:20px; margin-bottom:24px; font-size:14px;">
                <p style="margin:0 0 8px;color:#204B36;font-weight:600;font-family:'Nunito','Segoe UI',Arial,sans-serif;">Heads up</p>
                <p style="margin:0;color:#64748B;">This link expires in 24 hours and can only be used once. If you didn't request it, you can safely ignore this email.</p>
              </div>

              <p style="margin:0;color:#64748B;font-size:14px;">Need help? Reply to this email and the InsightScoop team will step in.</p>
            </div>

            <div style="padding:24px 32px;background-color:#204B36;color:#FAF7F1;line-height:1.6;">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.85;font-family:'Nunito','Segoe UI',Arial,sans-serif;">InsightScoop</p>
              <p style="margin:0 0 10px;font-size:13px;">Clean yards. Healthy pups. Wellness insights from every scoop.</p>
              <p style="margin:0;font-size:12px;opacity:0.8;">Need help? Call <a href="tel:1-877-417-9273" style="color:#F3645B;text-decoration:none;font-weight:600;">1-877-417-YARD</a>.</p>
              <p style="margin:16px 0 0;font-size:11px;opacity:0.6;">© ${new Date().getFullYear()} InsightScoop by Yardura. All rights reserved.</p>
            </div>
          </div>
        </div>
      `;

      try {
        if (emailConfig.provider === "smtp" && emailConfig.smtp) {
          const nodemailer = await import("nodemailer");
          const transport = nodemailer.createTransport(emailConfig.smtp as any);
          await transport.sendMail({ to: identifier, from: env.EMAIL_FROM, subject, text, html });
          return;
        }

        if (emailConfig.provider === "resend" && emailConfig.resendApiKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${emailConfig.resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: env.EMAIL_FROM, to: [identifier], subject, html, text }),
          });
          return;
        }

        // Console fallback (dev)
        console.log("\n[NextAuth] Magic sign-in link (DEV MODE):");
        console.log("To:", identifier);
        console.log("URL:", url);
        console.log("");
      } catch (error) {
        console.error("Email sending failed:", error);
        // Always print link as a last-resort fallback in non-production
        if (process.env.NODE_ENV !== "production") {
          console.log("\n[NextAuth] Magic sign-in link (FALLBACK):");
          console.log("To:", identifier);
          console.log("URL:", url);
          console.log("");
        }
      }
    },
  }),

  // Google provider (only if configured)
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),

  // Credentials provider for password-based auth
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials: any) {
      console.log(
        "🔐 AUTH ATTEMPT:",
        credentials?.email,
        "pwd length:",
        credentials?.password?.length,
      );

      try {
        if (!credentials?.email || !credentials?.password) {
          console.log("❌ Missing email or password");
          return null;
        }

        const normalizedEmail = normalizeEmail(credentials.email);
        console.log("🔍 Looking up user:", normalizedEmail);
        const user = await prisma.user.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: "insensitive" },
          },
          include: { accounts: true },
        });

        if (!user) {
          console.log("❌ User not found in database");
          return null;
        }

        console.log(
          "✅ User found:",
          user.email,
          "accounts:",
          user.accounts.length,
        );

        // Find credentials account
        const credentialsAccount = user.accounts.find(
          (account) => account.provider === "credentials",
        );

        if (!credentialsAccount) {
          console.log("❌ No credentials account found");
          return null;
        }

        if (!credentialsAccount.access_token) {
          console.log("❌ No password hash in credentials account");
          return null;
        }

        console.log("✅ Credentials account found with password hash");

        // Verify password
        console.log("🔐 Verifying password...");
        const isValid = await bcrypt.compare(
          credentials.password,
          credentialsAccount.access_token,
        );

        console.log(
          "Password verification result:",
          isValid ? "✅ SUCCESS" : "❌ FAILED",
        );

        if (!isValid) {
          return null;
        }

        const result = {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };

        console.log("🎉 Returning successful auth result:", result.email);
        return result;
      } catch (error) {
        console.error(
          "❌ Credentials auth error:",
          error instanceof Error ? error.message : "Unknown error",
        );
        return null;
      }
    },
  }),
];

// Configure NextAuth options
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: providers,
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    signIn: async ({ user, account: _account, profile: _profile }) => {
      console.log("[Auth Callback signIn] START:", { email: user?.email, hasAccount: !!_account });
      
      if (!user.email) {
        console.warn("[Auth] Sign-in blocked: no email provided");
        return false;
      }

      const normalizedEmail = user.email.toLowerCase().trim();

      // Admin emails are always allowed and get admin role
      if (isAdminEmail(normalizedEmail)) {
        console.log("[Auth Callback signIn] Admin email detected:", normalizedEmail);
        try {
          const existingAdmin = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { roles: true },
          });
          const existingRoles = (existingAdmin?.roles ?? []) as AppUserRole[];
          const adminRoles = sortRoles([...existingRoles, "ADMIN"]);
          await prisma.user.upsert({
            where: { email: normalizedEmail },
            update: { role: "ADMIN", roles: adminRoles, orgId: "yardura" },
            create: {
              email: normalizedEmail,
              name: user.name || normalizedEmail.split("@")[0],
              role: "ADMIN",
              roles: ["ADMIN"],
              orgId: "yardura",
            },
          });
          console.log("[Auth Callback signIn] Admin user created/updated, returning true");
          return true;
        } catch (error) {
          console.error("Error setting admin role:", error);
          return false;
        }
      }

      // For non-admin emails, check if user or customer exists
      try {
        const [existingUser, existingCustomer] = await Promise.all([
          prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, role: true },
          }),
          prisma.customer.findFirst({
            where: { email: normalizedEmail },
            select: { id: true, userId: true },
          }),
        ]);

        if (existingUser) {
          console.log(
            `[Auth] Existing user found: ${normalizedEmail} (${existingUser.role})`,
          );

          if (
            existingCustomer &&
            existingCustomer.userId !== existingUser.id
          ) {
            try {
              await prisma.customer.update({
                where: { id: existingCustomer.id },
                data: { userId: existingUser.id },
              });
              console.log(
                `[Auth] Linked customer ${existingCustomer.id} to user ${existingUser.id}`,
              );
            } catch (linkError) {
              console.warn(
                `[Auth] Failed to link customer ${existingCustomer.id} to user ${existingUser.id}:`,
                linkError,
              );
            }
          }

          return true;
        }

        if (existingCustomer) {
          if (existingCustomer.userId) {
            const linkedUser = await prisma.user.findUnique({
              where: { id: existingCustomer.userId },
              select: { id: true },
            });

            if (linkedUser) {
              console.log(
                `[Auth] Customer ${existingCustomer.id} already linked to user ${existingCustomer.userId}`,
              );
              return true;
            }

            await prisma.customer.update({
              where: { id: existingCustomer.id },
              data: { userId: null },
            });
          }

          const newUser = await prisma.user.create({
            data: {
              email: normalizedEmail,
              name: user.name || normalizedEmail.split("@")[0],
              role: "CUSTOMER",
              roles: ["CUSTOMER"],
              orgId: "yardura",
            },
            select: { id: true },
          });

          await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: { userId: newUser.id },
          });

          console.log(
            `[Auth] Created user ${newUser.id} and linked to customer ${existingCustomer.id}`,
          );
          return true;
        }

        console.warn(
          `[Auth] Sign-in blocked: ${normalizedEmail} is not an existing user or customer`,
        );
        return false;
      } catch (error) {
        console.error("[Auth] Error checking user/customer:", error);
        return false;
      }
    },
    session: async ({ session, token }) => {
      console.log("[Auth Callback session] START:", { email: session?.user?.email, hasToken: !!token, tokenUid: token?.uid });
      
      if (token?.uid && typeof token.uid === "string") {
        (session.user as any).id = token.uid;
      }

      // Get user role from database
      if (session?.user?.email) {
        try {
          let user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
              id: true,
              role: true,
              roles: true,
              orgId: true,
              customer: {
                select: { id: true },
              },
              scooperProfile: {
                select: { id: true, status: true },
              },
            },
          });

          // If user doesn't exist or isn't admin, and email is admin email, create/update admin user
          if (
            (!user || user.role !== "ADMIN") &&
            isAdminEmail(session.user.email)
          ) {
            const existingRoles = (user?.roles ?? []) as AppUserRole[];
            const adminRoles = sortRoles([...existingRoles, "ADMIN"]);
            user = await prisma.user.upsert({
              where: { email: session.user.email },
              update: { role: "ADMIN", roles: adminRoles, orgId: "yardura" },
              create: {
                email: session.user.email,
                name: session.user.name || session.user.email.split("@")[0],
                role: "ADMIN",
                roles: ["ADMIN"],
                orgId: "yardura",
              },
              select: {
                id: true,
                role: true,
                roles: true,
                orgId: true,
                customer: {
                  select: { id: true },
                },
                scooperProfile: {
                  select: { id: true, status: true },
                },
              },
            });
          }

          if (user) {
            (session as any).userRole = user.role;
            (session.user as any).role = user.role;
            (session.user as any).orgId = user.orgId;
          }

          const storedRoles = (user?.roles ?? []) as AppUserRole[];
          const derivedRoles = new Set<AppUserRole>();
          if (storedRoles.length === 0) {
            if (user?.role) {
              derivedRoles.add(user.role as AppUserRole);
            }
            if (user?.customer) {
              derivedRoles.add("CUSTOMER");
            }
            if (user?.scooperProfile) {
              derivedRoles.add("TECH");
            }
          } else {
            storedRoles.forEach((role) => derivedRoles.add(role));
          }

          const userRoles = sortRoles(derivedRoles);
          if (user && storedRoles.length === 0 && userRoles.length > 0) {
            const nextPrimary = userRoles[0] ?? user.role;
            try {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  roles: userRoles,
                  role: nextPrimary ?? undefined,
                },
              });
            } catch (updateError) {
              console.warn("[Auth] Failed to backfill user roles", updateError);
            }
          }
          (session as any).userRoles = userRoles;
          (session.user as any).roles = userRoles;

          const preferredRole = (token as any)?.activeRole as
            | AppUserRole
            | null
            | undefined;
          const resolvedActiveRole =
            preferredRole && userRoles.includes(preferredRole)
              ? preferredRole
              : userRoles.includes("CUSTOMER")
                ? "CUSTOMER"
                : userRoles[0] ?? null;
          (session as any).activeRole = resolvedActiveRole ?? null;
        } catch (error) {
          console.error("Error fetching/creating user role:", error);
          // Fallback: if email is admin email, set admin role
          if (isAdminEmail(session.user.email)) {
            (session as any).userRole = "ADMIN";
            (session.user as any).orgId = "yardura";
            (session.user as any).roles = ["ADMIN"];
            (session as any).userRoles = sortRoles(["ADMIN"]);
            (session as any).activeRole = "ADMIN";
          }
        }
      }

      // Set admin flag for admin users
      if (session?.user?.email && isAdminEmail(session.user.email)) {
        (session as any).isAdmin = true;
      }

      console.log("[Auth Callback session] RETURN:", { email: session?.user?.email, role: (session as any)?.userRole });
      return session;
    },
    jwt: async ({ user, token, trigger, session: updatedSession }) => {
      console.log("[Auth Callback jwt] START:", {
        hasUser: !!user,
        userId: user?.id,
        tokenUid: (token as any)?.uid,
        trigger,
      });
      if (user && user.id) {
        (token as any).uid = String(user.id);
      }
      if (trigger === "update" && updatedSession && "activeRole" in updatedSession) {
        (token as any).activeRole = (updatedSession as any).activeRole ?? null;
      }
      console.log("[Auth Callback jwt] RETURN:", {
        tokenUid: (token as any)?.uid,
        activeRole: (token as any)?.activeRole,
      });
      return token;
    },
    redirect: async ({ url, baseUrl }) => {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: shouldUseSecureCookies
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: shouldUseSecureCookies,
        domain: computedCookieDomain,
      },
    },
    callbackUrl: {
      name: shouldUseSecureCookies
        ? "__Secure-next-auth.callback-url"
        : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: shouldUseSecureCookies,
        domain: computedCookieDomain,
      },
    },
  },
  secret: env.NEXTAUTH_SECRET,
  useSecureCookies: shouldUseSecureCookies,
};

// Safe wrapper for getServerSession that prevents build-time errors
type MaybeNextRequest = Pick<NextRequest, "headers"> & {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
  };
  nextUrl?: URL;
};

function isNextRequest(value: unknown): value is MaybeNextRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "headers" in value &&
    "cookies" in value
  );
}

export async function safeGetServerSession(
  requestOrOptions: any = authOptions,
  maybeOptions?: any,
): Promise<any> {
  let options = authOptions;

  if (isNextRequest(requestOrOptions)) {
    options = maybeOptions ?? authOptions;
  } else if (requestOrOptions && requestOrOptions !== authOptions) {
    options = requestOrOptions;
  }

  // During build time or when NextAuth is disabled, return null
  if (
    typeof window === "undefined" &&
    process.env.DISABLE_NEXTAUTH_BUILD === "true"
  ) {
    console.log("[safeGetServerSession] Build time, returning null");
    return null;
  }

  try {
    // NOTE: Avoid making a network call to our own domain (which can deadlock/hang behind nginx).
    // `getServerSession` reads cookies/headers directly in the App Router environment.
    //
    // IMPORTANT: In production, if the DB/Prisma layer stalls (e.g., connection pool exhaustion),
    // NextAuth session lookups can hang the entire request. We fail-open with a short timeout
    // so public pages (landing, marketing) still render reliably.
    const timeoutMs = Number.parseInt(
      process.env.NEXTAUTH_SESSION_TIMEOUT_MS ?? "1500",
      10,
    );

    const sessionPromise = getServerSession(options).catch((err) => {
      console.error("[safeGetServerSession] getServerSession error:", err);
      return null;
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), Number.isFinite(timeoutMs) ? timeoutMs : 1500);
    });

    return await Promise.race([sessionPromise, timeoutPromise]);
  } catch (error) {
    console.error("[safeGetServerSession] ERROR:", error);
    return null;
  }
}
