import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProvider } from "@/providers"
import { sendSchema } from "@/lib/schemas/send"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { mailAccountId, ...draft } = parsed.data

  const account = await prisma.mailAccount.findFirst({
    where: { id: mailAccountId, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 })

  const provider = getProvider({ ...account, syncCursor: account.syncCursor ?? undefined })

  try {
    const result = await provider.sendMessage(draft)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
