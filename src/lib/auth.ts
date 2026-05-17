import { PrismaAdapter } from "@auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://mail.google.com/",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    async signIn({ user, account }) {
      if (
        account?.provider === "google" &&
        account.access_token &&
        account.refresh_token &&
        user.id &&
        user.email
      ) {
        const creds = {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : null,
        }
        try {
          await prisma.mailAccount.upsert({
            where: { userId_emailAddress: { userId: user.id, emailAddress: user.email } },
            create: {
              userId: user.id,
              type: "GMAIL",
              emailAddress: user.email,
              displayName: user.name ?? user.email,
              encryptedCreds: encrypt(JSON.stringify(creds)),
            },
            update: {
              encryptedCreds: encrypt(JSON.stringify(creds)),
              disconnectedAt: null,
            },
          })
        } catch {
          // non-fatal — auth still succeeds even if MailAccount upsert fails
        }
      }
      return true
    },
  },
}
