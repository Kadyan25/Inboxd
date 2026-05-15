import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAIProvider } from "@/services/ai"
import { summarizeOutputSchema } from "@/services/ai/schemas"
import type { NormalizedThread, NormalizedMessage } from "@/providers/types"

const bodySchema = z.object({
  threadId: z.string().min(1),
  mailAccountId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { threadId, mailAccountId } = parsed.data

  const account = await prisma.mailAccount.findFirst({
    where: { id: mailAccountId, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const dbMessages = await prisma.message.findMany({
    where: { threadId, mailAccountId },
    orderBy: { sentAt: "asc" },
    select: {
      providerMessageId: true,
      fromAddress: true,
      fromName: true,
      toAddresses: true,
      ccAddresses: true,
      bccAddresses: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      snippet: true,
      sentAt: true,
      isRead: true,
      isStarred: true,
      folder: true,
      providerMeta: true,
    },
  })

  if (dbMessages.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const lastMessageAt = dbMessages[dbMessages.length - 1].sentAt

  // Cache hit: same lastMessageAt means thread hasn't changed
  const cached = await prisma.threadSummary.findUnique({
    where: { threadId_mailAccountId: { threadId, mailAccountId } },
  })
  if (cached && cached.lastMessageAt.getTime() >= lastMessageAt.getTime()) {
    return NextResponse.json({
      summary: cached.summaryText,
      keyPoints: cached.keyPointsJson as string[],
      fromCache: true,
    })
  }

  // Build NormalizedThread for AI
  const normalizedMessages: NormalizedMessage[] = dbMessages.map((m) => ({
    providerMessageId: m.providerMessageId,
    threadId,
    from: { email: m.fromAddress, name: m.fromName ?? undefined },
    to: m.toAddresses.map((e) => ({ email: e })),
    cc: m.ccAddresses.map((e) => ({ email: e })),
    bcc: m.bccAddresses.map((e) => ({ email: e })),
    subject: m.subject,
    bodyText: m.bodyText,
    bodyHtml: m.bodyHtml,
    snippet: m.snippet ?? "",
    sentAt: m.sentAt,
    isRead: m.isRead,
    isStarred: m.isStarred,
    folder: m.folder as NormalizedMessage["folder"],
    providerMeta: (m.providerMeta as Record<string, unknown>) ?? {},
  }))

  const thread: NormalizedThread = {
    threadId,
    subject: dbMessages[0].subject,
    messages: normalizedMessages,
    participantCount: new Set(dbMessages.map((m) => m.fromAddress)).size,
    lastMessageAt,
  }

  try {
    const ai = getAIProvider()
    const raw = await ai.summarize({ thread })
    const validated = summarizeOutputSchema.safeParse(raw)
    if (!validated.success) {
      return NextResponse.json({ error: "ai_malformed_response" }, { status: 502 })
    }

    const { summary, keyPoints } = validated.data

    await prisma.threadSummary.upsert({
      where: { threadId_mailAccountId: { threadId, mailAccountId } },
      create: {
        threadId,
        mailAccountId,
        lastMessageAt,
        summaryText: summary,
        keyPointsJson: keyPoints,
        generatedByProvider: ai.name,
      },
      update: {
        lastMessageAt,
        summaryText: summary,
        keyPointsJson: keyPoints,
        generatedByProvider: ai.name,
        generatedAt: new Date(),
      },
    })

    return NextResponse.json({ summary, keyPoints, fromCache: false })
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 })
  }
}
