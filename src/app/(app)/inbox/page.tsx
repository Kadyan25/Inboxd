import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { isMockMode } from "@/lib/env"
import { ensureMockAccounts } from "@/lib/mock-seed"
import { InboxClient } from "@/components/inbox/inbox-client"

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/sign-in")

  // In mock mode, seed the DB with mock accounts + messages if not already present
  if (isMockMode) {
    await ensureMockAccounts(session.user.id)
  }

  return (
    <>
      {isMockMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-800">
          Demo mode — mock data loaded. Sign in to connect a real account.
        </div>
      )}
      <div className={isMockMode ? "pt-8" : ""}>
        <InboxClient />
      </div>
    </>
  )
}
