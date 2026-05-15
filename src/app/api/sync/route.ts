import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncAccount } from "@/services/sync"

const bodySchema = z.object({
  mailAccountId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.flatten() }, { status: 400 })
  }

  const account = await prisma.mailAccount.findFirst({
    where: { id: parsed.data.mailAccountId, userId: session.user.id },
  })

  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 })

  const outcome = await syncAccount({
    id: account.id,
    type: account.type,
    emailAddress: account.emailAddress,
    encryptedCreds: account.encryptedCreds,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    syncCursor: account.syncCursor ?? undefined,
  })

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 500 })
  }

  return NextResponse.json(outcome)
}
