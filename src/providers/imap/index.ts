import { ImapFlow } from "imapflow"
import { createTransport } from "nodemailer"
import { createHash } from "crypto"
import { decrypt } from "@/lib/encryption"
import type {
  EmailProvider,
  NormalizedMessage,
  NormalizedThread,
  NormalizedLabel,
  Draft,
  ListOpts,
  ListResult,
  SyncResult,
} from "@/providers/types"

// ─── MIME parsing ────────────────────────────────────────────────────────────

function parseHeaderBlock(raw: string): Map<string, string> {
  const map = new Map<string, string>()
  // Unfold continuation lines (CRLF followed by whitespace)
  const unfolded = raw.replace(/\r\n([ \t])/g, " ")
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":")
    if (colon > 0) {
      map.set(line.slice(0, colon).toLowerCase().trim(), line.slice(colon + 1).trim())
    }
  }
  return map
}

function decodeTransfer(content: string, encoding: string): string {
  const enc = encoding.toLowerCase().trim()
  if (enc === "base64") {
    return Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf-8")
  }
  if (enc === "quoted-printable") {
    return content
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  }
  return content
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

interface ParsedEmail {
  bodyText: string | null
  bodyHtml: string | null
  messageId: string | null
  references: string[]
  inReplyTo: string | null
}

function parseEmailSource(source: Buffer): ParsedEmail {
  const raw = source.toString("binary") // preserve all bytes
  const sep = raw.indexOf("\r\n\r\n")
  const headerRaw = sep >= 0 ? raw.slice(0, sep) : raw
  const bodyRaw = sep >= 0 ? raw.slice(sep + 4) : ""
  const headers = parseHeaderBlock(headerRaw)

  const contentType = headers.get("content-type") ?? "text/plain"
  const encoding = headers.get("content-transfer-encoding") ?? "7bit"
  const messageId = (headers.get("message-id") ?? "").replace(/[<>]/g, "").trim() || null
  const inReplyTo = (headers.get("in-reply-to") ?? "").replace(/[<>]/g, "").trim() || null
  const references =
    (headers.get("references") ?? "").match(/<[^>]+>/g)?.map((r) => r.slice(1, -1)) ?? []

  if (contentType.includes("multipart/")) {
    const bm = contentType.match(/boundary="?([^";\s]+)"?/)
    if (!bm) return { bodyText: null, bodyHtml: null, messageId, references, inReplyTo }
    const boundary = bm[1]
    const parts = bodyRaw.split(new RegExp(`--${escapeRe(boundary)}`))
    let bodyText: string | null = null
    let bodyHtml: string | null = null
    for (const part of parts.slice(1)) {
      if (part.trimStart().startsWith("--")) break
      const psep = part.indexOf("\r\n\r\n")
      if (psep < 0) continue
      const ph = parseHeaderBlock(part.slice(0, psep))
      const pct = ph.get("content-type") ?? "text/plain"
      const penc = ph.get("content-transfer-encoding") ?? "7bit"
      const pb = part.slice(psep + 4).replace(/\r\n$/, "")
      if (pct.includes("text/plain") && !bodyText) {
        bodyText = decodeTransfer(pb, penc)
      } else if (pct.includes("text/html") && !bodyHtml) {
        bodyHtml = decodeTransfer(pb, penc)
      } else if (pct.includes("multipart/")) {
        const nested = parseEmailSource(Buffer.from("\r\n" + part, "binary"))
        if (!bodyText) bodyText = nested.bodyText
        if (!bodyHtml) bodyHtml = nested.bodyHtml
      }
    }
    return { bodyText, bodyHtml, messageId, references, inReplyTo }
  }

  const decoded = decodeTransfer(bodyRaw, encoding)
  if (contentType.includes("text/html")) {
    return { bodyText: null, bodyHtml: decoded, messageId, references, inReplyTo }
  }
  return { bodyText: decoded, bodyHtml: null, messageId, references, inReplyTo }
}

function deriveThreadId(
  messageId: string | null,
  references: string[],
  inReplyTo: string | null
): string {
  const root = references[0] ?? inReplyTo ?? messageId ?? `imap-${Date.now()}`
  return createHash("sha256").update(root).digest("hex").slice(0, 24)
}

function folderToMailbox(folder: string): string {
  switch (folder) {
    case "SENT":    return "Sent"
    case "ARCHIVE": return "Archive"
    case "TRASH":   return "Trash"
    case "SPAM":    return "Spam"
    case "DRAFT":   return "Drafts"
    default:        return "INBOX"
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim()
}

function makeSnippet(bodyText: string | null, bodyHtml: string | null): string {
  return ((bodyText ?? stripHtml(bodyHtml ?? "")) || "").slice(0, 150)
}

// ─── ImapProvider ────────────────────────────────────────────────────────────

export class ImapProvider implements EmailProvider {
  readonly type = "IMAP" as const
  private user: string
  private password: string

  constructor(
    private accountId: string,
    encryptedCreds: string,
    private host: string,
    private port: number,
    private smtpHost: string,
    private smtpPort: number
  ) {
    const creds = JSON.parse(decrypt(encryptedCreds)) as { user: string; password: string }
    this.user = creds.user
    this.password = creds.password
  }

  private client(): ImapFlow {
    return new ImapFlow({
      host: this.host,
      port: this.port,
      secure: this.port === 993,
      auth: { user: this.user, pass: this.password },
      logger: false,
    })
  }

  async verifyConnection(): Promise<{ ok: true } | { ok: false; reason: string }> {
    const c = this.client()
    try {
      await c.connect()
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Connection failed" }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async listMessages(opts: ListOpts = {}): Promise<ListResult> {
    const { folder = "INBOX", limit = 50, cursor } = opts
    const c = this.client()
    try {
      await c.connect()
      const lock = await c.getMailboxLock(folderToMailbox(folder))
      try {
        const total: number = (c.mailbox as any)?.exists ?? 0
        if (total === 0) return { messages: [], nextCursor: undefined }

        const offset = cursor ? parseInt(cursor, 10) : 0
        const seqEnd = Math.max(1, total - offset)
        const seqStart = Math.max(1, seqEnd - limit + 1)

        const messages: NormalizedMessage[] = []
        for await (const msg of c.fetch(`${seqStart}:${seqEnd}`, {
          uid: true,
          envelope: true,
          flags: true,
          source: { start: 0, maxLength: 65536 },
        })) {
          const parsed = parseEmailSource(msg.source as Buffer)
          const env = msg.envelope!
          const threadId = deriveThreadId(parsed.messageId, parsed.references, parsed.inReplyTo)
          messages.push({
            providerMessageId: String(msg.uid),
            threadId,
            from: { email: env.from?.[0]?.address ?? "", name: env.from?.[0]?.name ?? undefined },
            to: (env.to ?? []).map((a) => ({ email: a.address ?? "", name: a.name ?? undefined })),
            cc: (env.cc ?? []).map((a) => ({ email: a.address ?? "", name: a.name ?? undefined })),
            bcc: [],
            subject: env.subject ?? null,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml,
            snippet: makeSnippet(parsed.bodyText, parsed.bodyHtml),
            sentAt: env.date ?? new Date(),
            isRead: msg.flags?.has("\\Seen") ?? false,
            isStarred: msg.flags?.has("\\Flagged") ?? false,
            folder: folder as NormalizedMessage["folder"],
            providerMeta: { uid: msg.uid, messageId: parsed.messageId },
          })
        }
        messages.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())

        const nextOffset = offset + messages.length
        return {
          messages,
          nextCursor: nextOffset < total ? String(nextOffset) : undefined,
        }
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async getThread(threadId: string): Promise<NormalizedThread> {
    const result = await this.listMessages({ limit: 200 })
    const msgs = result.messages.filter((m) => m.threadId === threadId)
    if (msgs.length === 0) throw new Error(`Thread not found: ${threadId}`)
    msgs.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
    const participants = new Set([...msgs.map((m) => m.from.email), ...msgs.flatMap((m) => m.to.map((t) => t.email))])
    return {
      threadId,
      subject: msgs[0].subject,
      messages: msgs,
      participantCount: participants.size,
      lastMessageAt: msgs[msgs.length - 1].sentAt,
    }
  }

  async sendMessage(draft: Draft): Promise<{ providerMessageId: string; threadId: string }> {
    const transport = createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpPort === 465,
      auth: { user: this.user, pass: this.password },
    })
    const info = await transport.sendMail({
      from: this.user,
      to: draft.to.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", "),
      cc: draft.cc?.map((a) => a.email).join(", "),
      bcc: draft.bcc?.map((a) => a.email).join(", "),
      subject: draft.subject,
      text: draft.bodyText,
      html: draft.bodyHtml ?? undefined,
      inReplyTo: draft.inReplyTo ?? undefined,
    })
    const msgId = (info.messageId as string ?? "").replace(/[<>]/g, "")
    const threadId =
      draft.threadId ??
      createHash("sha256")
        .update(msgId || String(Date.now()))
        .digest("hex")
        .slice(0, 24)
    return { providerMessageId: msgId, threadId }
  }

  async archive(uid: string): Promise<void> {
    await this.moveMessage(uid, "INBOX", "Archive")
  }

  async trash(uid: string): Promise<void> {
    await this.moveMessage(uid, "INBOX", "Trash")
  }

  async permanentlyDelete(uid: string): Promise<void> {
    const c = this.client()
    try {
      await c.connect()
      const lock = await c.getMailboxLock("Trash")
      try {
        await c.messageDelete(uid, { uid: true })
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async markRead(uid: string, read: boolean): Promise<void> {
    const c = this.client()
    try {
      await c.connect()
      const lock = await c.getMailboxLock("INBOX")
      try {
        if (read) {
          await c.messageFlagsAdd(uid, ["\\Seen"], { uid: true })
        } else {
          await c.messageFlagsRemove(uid, ["\\Seen"], { uid: true })
        }
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async listLabels(): Promise<NormalizedLabel[]> {
    const c = this.client()
    try {
      await c.connect()
      const mailboxes = await c.list()
      return mailboxes
        .filter((m) => !m.flags?.has("\\Noselect"))
        .map((m) => ({
          providerLabelId: m.path,
          name: m.name,
          isSystem: ["INBOX", "Sent", "Trash", "Drafts", "Spam", "Archive"].includes(m.name),
        }))
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async applyLabel(uid: string, labelId: string): Promise<void> {
    const c = this.client()
    try {
      await c.connect()
      const lock = await c.getMailboxLock("INBOX")
      try {
        await c.messageFlagsAdd(uid, [labelId], { uid: true })
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async removeLabel(uid: string, labelId: string): Promise<void> {
    const c = this.client()
    try {
      await c.connect()
      const lock = await c.getMailboxLock("INBOX")
      try {
        await c.messageFlagsRemove(uid, [labelId], { uid: true })
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async search(query: string, opts: Pick<ListOpts, "limit" | "cursor"> = {}): Promise<ListResult> {
    const c = this.client()
    try {
      await c.connect()
      const lock = await c.getMailboxLock("INBOX")
      try {
        const uids = (await c.search({ text: query }, { uid: true })) as number[]
        if (!uids || uids.length === 0) return { messages: [] }

        const limit = opts.limit ?? 50
        const sliced = uids.slice(0, limit)
        const range = sliced.join(",")
        const messages: NormalizedMessage[] = []

        for await (const msg of c.fetch(
          range,
          { uid: true, envelope: true, flags: true, source: { start: 0, maxLength: 65536 } },
          { uid: true }
        )) {
          const parsed = parseEmailSource(msg.source as Buffer)
          const env = msg.envelope!
          const threadId = deriveThreadId(parsed.messageId, parsed.references, parsed.inReplyTo)
          messages.push({
            providerMessageId: String(msg.uid),
            threadId,
            from: { email: env.from?.[0]?.address ?? "", name: env.from?.[0]?.name ?? undefined },
            to: (env.to ?? []).map((a) => ({ email: a.address ?? "", name: a.name ?? undefined })),
            cc: [],
            bcc: [],
            subject: env.subject ?? null,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml,
            snippet: makeSnippet(parsed.bodyText, parsed.bodyHtml),
            sentAt: env.date ?? new Date(),
            isRead: msg.flags?.has("\\Seen") ?? false,
            isStarred: msg.flags?.has("\\Flagged") ?? false,
            folder: "INBOX",
            providerMeta: { uid: msg.uid },
          })
        }
        return { messages }
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  async syncChanges(lastCursor: string | null): Promise<SyncResult> {
    const c = this.client()
    try {
      await c.connect()
      const lock = await c.getMailboxLock("INBOX")
      try {
        const mbInfo = c.mailbox as any
        const uidValidity: number = Number(mbInfo?.uidValidity ?? 0)
        const total: number = mbInfo?.exists ?? 0

        let lastUid = 0
        let lastValidity = 0
        if (lastCursor) {
          const [v, u] = lastCursor.split(":")
          lastValidity = parseInt(v, 10)
          lastUid = parseInt(u, 10)
        }

        // UIDVALIDITY changed → treat as full resync
        if (lastValidity && lastValidity !== uidValidity) lastUid = 0

        if (total === 0) {
          return { newMessages: [], updatedMessages: [], deletedMessageIds: [], nextCursor: `${uidValidity}:0` }
        }

        // On first sync, limit to most recent 100 messages by sequence number
        let fetchRange: string
        if (lastUid === 0) {
          const start = Math.max(1, total - 99)
          fetchRange = `${start}:*`
        } else {
          fetchRange = `${lastUid + 1}:*`
        }

        const newMessages: NormalizedMessage[] = []

        const fetchOpts = lastUid === 0
          ? c.fetch(fetchRange, { uid: true, envelope: true, flags: true, source: { start: 0, maxLength: 65536 } })
          : c.fetch(fetchRange, { uid: true, envelope: true, flags: true, source: { start: 0, maxLength: 65536 } }, { uid: true })

        for await (const msg of fetchOpts) {
          const parsed = parseEmailSource(msg.source as Buffer)
          const env = msg.envelope!
          const threadId = deriveThreadId(parsed.messageId, parsed.references, parsed.inReplyTo)
          newMessages.push({
            providerMessageId: String(msg.uid),
            threadId,
            from: { email: env.from?.[0]?.address ?? "", name: env.from?.[0]?.name ?? undefined },
            to: (env.to ?? []).map((a) => ({ email: a.address ?? "", name: a.name ?? undefined })),
            cc: (env.cc ?? []).map((a) => ({ email: a.address ?? "", name: a.name ?? undefined })),
            bcc: [],
            subject: env.subject ?? null,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml,
            snippet: makeSnippet(parsed.bodyText, parsed.bodyHtml),
            sentAt: env.date ?? new Date(),
            isRead: msg.flags?.has("\\Seen") ?? false,
            isStarred: msg.flags?.has("\\Flagged") ?? false,
            folder: "INBOX",
            providerMeta: { uid: msg.uid, messageId: parsed.messageId },
          })
        }

        const highestUid = newMessages.reduce((max, m) => {
          const uid = Number(m.providerMessageId)
          return uid > max ? uid : max
        }, lastUid)

        return {
          newMessages,
          updatedMessages: [],
          deletedMessageIds: [],
          nextCursor: `${uidValidity}:${highestUid}`,
        }
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }

  private async moveMessage(uid: string, from: string, to: string): Promise<void> {
    const c = this.client()
    try {
      await c.connect()
      // Create target mailbox if it doesn't exist
      await c.mailboxCreate(to).catch(() => {})
      const lock = await c.getMailboxLock(from)
      try {
        await c.messageMove(uid, to, { uid: true })
      } finally {
        lock.release()
      }
    } finally {
      await c.logout().catch(() => {})
    }
  }
}
