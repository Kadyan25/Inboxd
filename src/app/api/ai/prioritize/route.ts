import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAIProvider } from "@/services/ai"

const messageSchema = z.object({
  providerMessageId: z.string(),
  from: z.object({ email: z.string(), name: z.string().optional() }),
  subject: z.string().nullable(),
  snippet: z.string(),
  sentAt: z.coerce.date(),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 })
  }

  // Daily cost limiter
  const limit = parseInt(process.env.AI_DAILY_CALL_LIMIT ?? "1000")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const usedToday = await prisma.message.count({
    where: { aiPrioritizedAt: { gte: today } },
  })
  if (usedToday + parsed.data.messages.length > limit) {
    return NextResponse.json({ error: "daily_limit_exceeded" }, { status: 429 })
  }

  try {
    const ai = getAIProvider()
    const result = await ai.prioritize({ messages: parsed.data.messages })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 })
  }
}
