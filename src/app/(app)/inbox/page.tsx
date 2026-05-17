import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { InboxClient } from "@/components/inbox/inbox-client"
import { prisma } from "@/lib/prisma"

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/sign-in")

  const realAccounts = await prisma.mailAccount.findMany({
    where: { userId: session.user.id, disconnectedAt: null, type: { not: "MOCK" } },
    select: { id: true, type: true, emailAddress: true, displayName: true, lastSyncAt: true },
    orderBy: { connectedAt: "asc" },
  })

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
