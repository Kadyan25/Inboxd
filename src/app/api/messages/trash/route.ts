import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProvider } from "@/providers"

const bodySchema = z.object({ messageId: z.string().min(1) })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 })

  const message = await prisma.message.findFirst({
    where: { id: parsed.data.messageId },
    include: { mailAccount: true },
  })

  if (!message || message.mailAccount.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const provider = getProvider({
    ...message.mailAccount,
    syncCursor: message.mailAccount.syncCursor ?? undefined,
  })
  await provider.trash(message.providerMessageId)
  await prisma.message.update({ where: { id: message.id }, data: { folder: "TRASH" } })

  return NextResponse.json({ ok: true })
}
