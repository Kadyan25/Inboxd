import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { InboxClient } from "@/components/inbox/inbox-client"
import { prisma } from "@/lib/prisma"
import { ensureMockAccounts } from "@/lib/mock-seed"
import { encrypt } from "@/lib/encryption"

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/sign-in")

  // If the GMAIL account wasn't created in the signIn callback (race condition),
  // create it now when the User is guaranteed to be committed.
  const oauthAccount = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "google" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  })
  if (oauthAccount?.refresh_token && session.user.email) {
    const creds = {
      accessToken: oauthAccount.access_token,
      refreshToken: oauthAccount.refresh_token,
      expiresAt: oauthAccount.expires_at ? oauthAccount.expires_at * 1000 : null,
    }
    await prisma.mailAccount.upsert({
      where: { userId_emailAddress: { userId: session.user.id, emailAddress: session.user.email } },
      create: {
        userId: session.user.id,
        type: "GMAIL",
        emailAddress: session.user.email,
        displayName: session.user.name ?? session.user.email,
        encryptedCreds: encrypt(JSON.stringify(creds)),
      },
      update: {
        encryptedCreds: encrypt(JSON.stringify(creds)),
        disconnectedAt: null,
      },
    }).catch(() => {})
  }

  const realAccounts = await prisma.mailAccount.findMany({
    where: { userId: session.user.id, disconnectedAt: null, type: { not: "MOCK" } },
    select: { id: true, type: true, emailAddress: true, displayName: true, lastSyncAt: true },
    orderBy: { connectedAt: "asc" },
  })

  // No real accounts — seed mock data so the demo inbox is never empty
  if (realAccounts.length === 0) {
    await ensureMockAccounts(session.user.id)
  }

  const accountIds = realAccounts.map((a) => a.id)
  const needsInitialSync = realAccounts.filter((a) => !a.lastSyncAt).map((a) => a.id)

  const accounts = realAccounts.map((a) => ({
    id: a.id,
    type: a.type as "GMAIL" | "IMAP" | "GRAPH",
    emailAddress: a.emailAddress,
    displayName: a.displayName,
    lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
  }))

  return (
    <InboxClient
      accountIds={accountIds}
      initialSyncAccountIds={needsInitialSync}
      accounts={accounts}
    />
  )
}
