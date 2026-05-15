import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProvider } from "@/providers"

const querySchema = z.object({ mailAccountId: z.string().min(1) })

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 })

  const account = await prisma.mailAccount.findFirst({
    where: { id: parsed.data.mailAccountId, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const provider = getProvider({ ...account, syncCursor: account.syncCursor ?? undefined })
  const labels = await provider.listLabels()

  return NextResponse.json({ labels })
}
