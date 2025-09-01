import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { env, getEmailConfig, isAdminEmail } from "./env"

// Get email configuration
const emailConfig = getEmailConfig();

// Configure providers based on available environment variables
const providers: any[] = [
  // Email provider for magic links (always available)
  EmailProvider({
    server: emailConfig.provider === 'smtp' ? {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    } : undefined,
    from: env.EMAIL_FROM,
    async sendVerificationRequest({ identifier, url, provider }) {
      const host = new URL(env.NEXTAUTH_URL).host;

      // Development: log to console if no SMTP configured
      if (emailConfig.provider === 'resend' || !emailConfig.host) {
        console.log("\n[NextAuth] Magic sign-in link (DEV):\n", url, "\n");
        return;
      }

      // Use nodemailer for SMTP
      const nodemailer = await import('nodemailer');
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
    },
  }),

  // Google provider (only if configured)
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    })
  ] : []),

  // Credentials provider for password-based auth
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      // Skip database operations during build time
      if (process.env.NODE_ENV === 'production' && process.env.CI) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() },
        include: { accounts: true }
      });

      if (!user) {
        return null;
      }

      // Find credentials account
      const credentialsAccount = user.accounts.find(
        (account) => account.provider === 'credentials'
      );

      if (!credentialsAccount?.access_token) {
        return null;
      }

      // Verify password
      const isValid = await bcrypt.compare(
        credentials.password,
        credentialsAccount.access_token
      );

      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    }
  }),
];

// Only use PrismaAdapter in runtime, not during build
const getAdapter = () => {
  // Skip adapter during build to prevent database connection issues
  if (process.env.NODE_ENV === 'production' && !process.env.CI) {
    return PrismaAdapter(prisma);
  }
  return undefined;
};

export const authOptions: NextAuthOptions = {
  adapter: getAdapter(),
  providers,
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      // Skip database operations during build time
      if (process.env.NODE_ENV === 'production' && process.env.CI) {
        return true;
      }

      // Set admin role for admin emails during sign-in
      if (user.email && isAdminEmail(user.email)) {
        try {
          await prisma.user.upsert({
            where: { email: user.email },
            update: { role: 'ADMIN' },
            create: {
              email: user.email,
              name: user.name || user.email.split('@')[0],
              role: 'ADMIN',
            },
          });
        } catch (error) {
          console.error('Error setting admin role:', error);
        }
      }
      return true;
    },
    session: async ({ session, token }) => {
      if (session?.user && token && typeof (token as any).uid === 'string') {
        session.user.id = (token as any).uid as string;
      }

      // Get user role from database (skip during build)
      if (session.user.email && !(process.env.NODE_ENV === 'production' && process.env.CI)) {
        try {
          const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
          });

          if (user) {
            (session as any).userRole = user.role;
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
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
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: env.NEXTAUTH_SECRET,
}
