import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { accounts: true }
        })

        if (!user) {
          return null
        }

        // Find credentials account
        const credentialsAccount = user.accounts.find(
          (account: { provider: string; access_token: string | null }) => account.provider === 'credentials'
        )

        if (!credentialsAccount?.access_token) {
          return null
        }

        // Verify password
        const isValid = await bcrypt.compare(
          credentials.password,
          credentialsAccount.access_token
        )

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      }
    }),
    EmailProvider({
      server: (() => {
        const host = process.env.EMAIL_SERVER_HOST
        const port = Number(process.env.EMAIL_SERVER_PORT || 587)
        const user = process.env.EMAIL_SERVER_USER
        const pass = process.env.EMAIL_SERVER_PASSWORD
        const base: any = {
          host,
          port,
          secure: port === 465,
        }
        if (user && pass) {
          base.auth = { user, pass }
        }
        return base
      })(),
      from: process.env.EMAIL_FROM,
      // Dev-friendly: if no SMTP host configured, log magic link to server console
      async sendVerificationRequest({ identifier, url, provider }) {
        const host = new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').host
        if (!process.env.EMAIL_SERVER_HOST) {
          console.log("\n[NextAuth] Magic sign-in link (DEV):\n", url, "\n")
          return
        }
        // Use nodemailer when SMTP is configured
        const nodemailer = await import('nodemailer')
        const transport = (nodemailer as any).createTransport(provider.server as any)
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: `Sign in to ${host}`,
          text: `Sign in link for ${host}:\n${url}\n`,
          html: `<p>Sign in to <strong>${host}</strong></p><p><a href="${url}">Click here to sign in</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
        })
      },
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user && token && typeof (token as any).uid === 'string') {
        session.user.id = (token as any).uid as string
      }

      // Get user role from database
      const user = await prisma.user.findUnique({
        where: { email: session.user.email! },
        select: { role: true }
      })

      if (user) {
        ;(session as any).userRole = user.role
      }

      // Gate admin UI in session as a convenience
      const admins = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
      if (session?.user?.email && admins.includes(session.user.email.toLowerCase())) {
        ;(session as any).isAdmin = true
      }
      return session
    },
    jwt: async ({ user, token }) => {
      if (user && user.id) {
        ;(token as any).uid = String(user.id)
      }
      return token
    },
    redirect: async ({ url, baseUrl }) => {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  session: {
    strategy: 'jwt',
  },
}
