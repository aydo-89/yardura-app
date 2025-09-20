import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { env, getEmailConfig, isAdminEmail } from "./env";

// Get email configuration
const emailConfig = getEmailConfig();

// Import NextAuth components
import NextAuth, { NextAuthOptions } from "next-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

const providers = [
  // Email provider for magic links (always available)
  EmailProvider({
    server:
      emailConfig.provider === "smtp" && emailConfig.smtp
        ? {
            host: emailConfig.smtp.host,
            port: emailConfig.smtp.port,
            secure: emailConfig.smtp.port === 465,
            auth: {
              user: emailConfig.smtp.auth.user,
              pass: emailConfig.smtp.auth.pass,
            },
          }
        : undefined,
    from: env.EMAIL_FROM,
    async sendVerificationRequest({ identifier, url, provider }: any) {
      const host = new URL(env.NEXTAUTH_URL || "http://localhost:3000").host;

      try {
        // Use nodemailer for SMTP
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport(provider.server as any);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: `Sign in to ${host}`,
          text: `Sign in link for ${host}:\n${url}\n\nIf you did not request this, you can safely ignore this email.`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Sign in to ${host}</h2>
            <p>Hello,</p>
            <p>Click the link below to sign in to your Yardura account:</p>
            <p style="margin: 30px 0;">
              <a href="${url}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign In</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              If you did not request this sign-in link, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              This link will expire in 24 hours for security reasons.
            </p>
          </div>
        `,
        });
      } catch (error) {
        console.error("Email sending failed:", error);
        // In development, still log the link even if sending fails
        if (emailConfig.provider === "console") {
          console.log("\n[NextAuth] Magic sign-in link (DEV MODE):");
          console.log("To:", identifier);
          console.log("URL:", url);
          console.log("Email sending failed, but link is available above\n");
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

        console.log("🔍 Looking up user:", credentials.email.toLowerCase());
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
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
      // Set admin role for admin emails during sign-in
      if (user.email && isAdminEmail(user.email)) {
        try {
          await prisma.user.upsert({
            where: { email: user.email },
            update: { role: "ADMIN", orgId: "yardura" },
            create: {
              email: user.email,
              name: user.name || user.email.split("@")[0],
              role: "ADMIN",
              orgId: "yardura",
            },
          });
        } catch (error) {
          console.error("Error setting admin role:", error);
        }
      }
      return true;
    },
    session: async ({ session, token }) => {
      if (token?.uid && typeof token.uid === "string") {
        (session.user as any).id = token.uid;
      }

      // Get user role from database
      if (session?.user?.email) {
        try {
          let user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { role: true, orgId: true },
          });

          // If user doesn't exist or isn't admin, and email is admin email, create/update admin user
          if (
            (!user || user.role !== "ADMIN") &&
            isAdminEmail(session.user.email)
          ) {
            user = await prisma.user.upsert({
              where: { email: session.user.email },
              update: { role: "ADMIN", orgId: "yardura" },
              create: {
                email: session.user.email,
                name: session.user.name || session.user.email.split("@")[0],
                role: "ADMIN",
                orgId: "yardura",
              },
              select: { role: true, orgId: true },
            });
          }

          if (user) {
            (session as any).userRole = user.role;
            (session.user as any).role = user.role;
            (session.user as any).orgId = user.orgId;
          }
        } catch (error) {
          console.error("Error fetching/creating user role:", error);
          // Fallback: if email is admin email, set admin role
          if (isAdminEmail(session.user.email)) {
            (session as any).userRole = "ADMIN";
            (session.user as any).orgId = "yardura";
          }
        }
      }

      // Set admin flag for admin users
      if (session?.user?.email && isAdminEmail(session.user.email)) {
        (session as any).isAdmin = true;
      }

      return session;
    },
    jwt: async ({ user, token }) => {
      if (user && user.id) {
        (token as any).uid = String(user.id);
      }
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
  secret: env.NEXTAUTH_SECRET,
};

// Safe wrapper for getServerSession that prevents build-time errors
export async function safeGetServerSession(options: any): Promise<any> {
  // During build time or when NextAuth is disabled, return null
  if (
    typeof window === "undefined" &&
    process.env.DISABLE_NEXTAUTH_BUILD === "true"
  ) {
    return null;
  }

  try {
    const { getServerSession } = await import("next-auth/next");
    return await getServerSession(options);
  } catch (error) {
    console.warn("getServerSession failed, returning null:", error);
    return null;
  }
}
