import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const querySchema = z.object({
  threadId: z.string().min(1),
  mailAccountId: z.string().min(1),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 })

  const { threadId, mailAccountId } = parsed.data

  // Verify account belongs to user
  const account = await prisma.mailAccount.findFirst({
    where: { id: mailAccountId, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const messages = await prisma.message.findMany({
    where: { threadId, mailAccountId },
    orderBy: { sentAt: "asc" },
    select: {
      id: true,
      providerMessageId: true,
      threadId: true,
      mailAccountId: true,
      fromAddress: true,
      fromName: true,
      toAddresses: true,
      ccAddresses: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      snippet: true,
      sentAt: true,
      isRead: true,
      isStarred: true,
      folder: true,
    },
  })

  // Mark unread messages as read
  const unreadIds = messages.filter((m) => !m.isRead).map((m) => m.id)
  if (unreadIds.length > 0) {
    await prisma.message.updateMany({ where: { id: { in: unreadIds } }, data: { isRead: true } })
  }

  return NextResponse.json({ messages })
}
