import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

// Creates a stub Outlook/Graph account that returns mock data.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Stub creds: empty — GraphProvider ignores them and delegates to MockProvider
  const encryptedCreds = encrypt(JSON.stringify({ stub: true }))

  const account = await prisma.mailAccount.upsert({
    where: { userId_emailAddress: { userId: session.user.id, emailAddress: "outlook@stub.inboxd" } },
    create: {
      userId: session.user.id,
      type: "GRAPH",
      emailAddress: "outlook@stub.inboxd",
      displayName: "Outlook (Demo)",
      encryptedCreds,
    },
    update: { disconnectedAt: null },
    select: { id: true, emailAddress: true, type: true },
  })

  return NextResponse.json({ ok: true, account })
}
