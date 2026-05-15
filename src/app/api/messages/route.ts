import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const querySchema = z.object({
  folder: z.enum(["INBOX", "SENT", "ARCHIVE", "TRASH", "DRAFT", "SPAM"]).default("INBOX"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  accountId: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const { folder, limit, cursor, accountId } = parsed.data

  // Get all accounts for this user (or just the requested one)
  const accountWhere = accountId
    ? { id: accountId, userId: session.user.id }
    : { userId: session.user.id }

  const accounts = await prisma.mailAccount.findMany({ where: accountWhere, select: { id: true } })
  const accountIds = accounts.map((a) => a.id)

  const cursorDate = cursor ? new Date(cursor) : undefined

  const messages = await prisma.message.findMany({
    where: {
      mailAccountId: { in: accountIds },
      folder,
      ...(cursorDate ? { sentAt: { lt: cursorDate } } : {}),
    },
    orderBy: { sentAt: "desc" },
    take: limit + 1,
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

  const hasMore = messages.length > limit
  const page = hasMore ? messages.slice(0, limit) : messages
  const nextCursor = hasMore ? page[page.length - 1].sentAt.toISOString() : undefined

  return NextResponse.json({ messages: page, nextCursor })
}
