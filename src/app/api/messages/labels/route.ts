import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProvider } from "@/providers"

const bodySchema = z.object({
  messageId: z.string().min(1),
  labelId: z.string().min(1),
  action: z.enum(["apply", "remove"]),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 })

  const { messageId, labelId, action } = parsed.data

  const message = await prisma.message.findFirst({
    where: { id: messageId },
    include: { mailAccount: true },
  })
  if (!message || message.mailAccount.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const provider = getProvider({
    ...message.mailAccount,
    syncCursor: message.mailAccount.syncCursor ?? undefined,
  })

  if (action === "apply") {
    await provider.applyLabel(message.providerMessageId, labelId)
  } else {
    await provider.removeLabel(message.providerMessageId, labelId)
  }

  return NextResponse.json({ ok: true })
}
