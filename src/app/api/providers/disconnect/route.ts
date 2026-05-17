import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({ accountId: z.string().min(1) })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 })

  const account = await prisma.mailAccount.findFirst({
    where: { id: parsed.data.accountId, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 })

  await prisma.mailAccount.update({
    where: { id: account.id },
    data: { disconnectedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
