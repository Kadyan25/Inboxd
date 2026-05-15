import { prisma } from "@/lib/prisma"
import { getProvider, type ProviderAccount } from "@/providers"
import { getAIProvider } from "@/services/ai"
import type { NormalizedMessage } from "@/providers/types"
import type { Prisma } from "@prisma/client"

export type SyncOutcome =
  | { ok: true; newCount: number; updatedCount: number; deletedCount: number }
  | { ok: false; error: string }

export async function syncAccount(account: ProviderAccount): Promise<SyncOutcome> {
  const provider = getProvider(account)

  // Verify connection is alive before syncing
  const check = await provider.verifyConnection()
  if (!check.ok) return { ok: false, error: check.reason }

  // Mark account as syncing
  await prisma.mailAccount.update({
    where: { id: account.id },
    data: { syncStatus: "SYNCING", syncError: null },
  })

  try {
    const result = await provider.syncChanges(account.syncCursor ?? null)

    // Upsert new + updated messages
    if (result.newMessages.length > 0 || result.updatedMessages.length > 0) {
      const toUpsert = [...result.newMessages, ...result.updatedMessages]
      await Promise.all(toUpsert.map((msg) => upsertMessage(msg, account.id)))
    }

    // Prioritize newly synced messages (skip if already prioritized)
    if (result.newMessages.length > 0) {
      await prioritizeNewMessages(result.newMessages, account.id)
    }

    // Soft-delete removed messages (mark as TRASH)
    if (result.deletedMessageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          mailAccountId: account.id,
          providerMessageId: { in: result.deletedMessageIds },
        },
        data: { folder: "TRASH" },
      })
    }

    // Update cursor and status
    await prisma.mailAccount.update({
      where: { id: account.id },
      data: {
        syncStatus: "IDLE",
        syncCursor: result.nextCursor,
        lastSyncAt: new Date(),
      },
    })

    return {
      ok: true,
      newCount: result.newMessages.length,
      updatedCount: result.updatedMessages.length,
      deletedCount: result.deletedMessageIds.length,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown sync error"
    await prisma.mailAccount.update({
      where: { id: account.id },
      data: { syncStatus: "ERROR", syncError: error },
    })
    return { ok: false, error }
  }
}

async function upsertMessage(msg: NormalizedMessage, mailAccountId: string): Promise<void> {
  const data: Prisma.MessageUncheckedCreateInput = {
    mailAccountId,
    providerMessageId: msg.providerMessageId,
    threadId: msg.threadId,
    fromAddress: msg.from.email,
    fromName: msg.from.name ?? null,
    toAddresses: msg.to.map((a) => a.email),
    ccAddresses: msg.cc.map((a) => a.email),
    bccAddresses: msg.bcc.map((a) => a.email),
    subject: msg.subject,
    bodyText: msg.bodyText,
    bodyHtml: msg.bodyHtml,
    snippet: msg.snippet.slice(0, 500),
    sentAt: msg.sentAt,
    isRead: msg.isRead,
    isStarred: msg.isStarred,
    folder: msg.folder,
    providerMeta: msg.providerMeta as Prisma.InputJsonValue,
  }

  await prisma.message.upsert({
    where: { mailAccountId_providerMessageId: { mailAccountId, providerMessageId: msg.providerMessageId } },
    create: data,
    update: {
      isRead: msg.isRead,
      isStarred: msg.isStarred,
      folder: msg.folder,
      providerMeta: msg.providerMeta as Prisma.InputJsonValue,
    },
  })
}

async function prioritizeNewMessages(messages: NormalizedMessage[], mailAccountId: string): Promise<void> {
  // Only prioritize messages that don't already have a priority
  const providerIds = messages.map((m) => m.providerMessageId)
  const unprioritized = await prisma.message.findMany({
    where: { mailAccountId, providerMessageId: { in: providerIds }, aiPriority: null },
    select: { providerMessageId: true, fromAddress: true, fromName: true, subject: true, snippet: true, sentAt: true },
  })
  if (unprioritized.length === 0) return

  const ai = getAIProvider()
  // Batch in chunks of 20
  for (let i = 0; i < unprioritized.length; i += 20) {
    const chunk = unprioritized.slice(i, i + 20)
    try {
      const result = await ai.prioritize({
        messages: chunk.map((m) => ({
          providerMessageId: m.providerMessageId,
          from: { email: m.fromAddress, name: m.fromName ?? undefined },
          subject: m.subject,
          snippet: m.snippet ?? "",
          sentAt: m.sentAt,
        })),
      })
      await Promise.all(
        result.results.map((r) =>
          prisma.message.updateMany({
            where: { mailAccountId, providerMessageId: r.providerMessageId },
            data: { aiPriority: r.priority, aiPriorityReason: r.reason, aiPrioritizedAt: new Date() },
          })
        )
      )
    } catch {
      // Non-blocking — prioritization failure does not fail sync
    }
  }
}
