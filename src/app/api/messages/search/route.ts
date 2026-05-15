import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 })

  const { q, limit } = parsed.data

  const accounts = await prisma.mailAccount.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })
  const accountIds = accounts.map((a) => a.id)

  const messages = await prisma.message.findMany({
    where: {
      mailAccountId: { in: accountIds },
      folder: { notIn: ["TRASH", "SPAM"] },
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        { fromAddress: { contains: q, mode: "insensitive" } },
        { fromName: { contains: q, mode: "insensitive" } },
        { snippet: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { sentAt: "desc" },
    take: limit,
    select: {
      id: true,
      mailAccountId: true,
      providerMessageId: true,
      threadId: true,
      fromAddress: true,
      fromName: true,
      subject: true,
      snippet: true,
      sentAt: true,
      isRead: true,
      isStarred: true,
      folder: true,
      aiPriority: true,
      aiPriorityReason: true,
    },
  })

  return NextResponse.json({ messages })
}
