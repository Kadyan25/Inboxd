import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"
import { ImapProvider } from "@/providers/imap"

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "App password is required"),
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().min(1).max(65535),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  displayName: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, imapHost, imapPort, smtpHost, smtpPort, displayName } = parsed.data

  // Test connection before saving
  const encryptedCreds = encrypt(JSON.stringify({ user: email, password }))
  const provider = new ImapProvider("test", encryptedCreds, imapHost, imapPort, smtpHost, smtpPort)
  const check = await provider.verifyConnection()
  if (!check.ok) {
    return NextResponse.json({ error: "connection_failed", reason: check.reason }, { status: 400 })
  }

  const account = await prisma.mailAccount.upsert({
    where: { userId_emailAddress: { userId: session.user.id, emailAddress: email } },
    create: {
      userId: session.user.id,
      type: "IMAP",
      emailAddress: email,
      displayName: displayName ?? email,
      encryptedCreds,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
    },
    update: {
      encryptedCreds,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      displayName: displayName ?? email,
      disconnectedAt: null,
      syncCursor: null,
      lastSyncAt: null,
    },
    select: { id: true, emailAddress: true, type: true },
  })

  return NextResponse.json({ ok: true, account })
}
