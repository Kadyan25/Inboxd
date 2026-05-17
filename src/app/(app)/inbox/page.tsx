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
    select: { id: true, lastSyncAt: true },
  })

  const accountIds = realAccounts.map((a) => a.id)
  const needsInitialSync = realAccounts.filter((a) => !a.lastSyncAt).map((a) => a.id)

  return (
    <InboxClient accountIds={accountIds} initialSyncAccountIds={needsInitialSync} />
  )
}
