import { prisma } from "@/lib/prisma"
import { syncAccount } from "@/services/sync"
import { MOCK_ACCOUNTS } from "@/providers/mock/fixtures/messages"

// Ensures the three mock mail accounts exist for a user and are synced.
// Idempotent — safe to call on every inbox load.
export async function ensureMockAccounts(userId: string): Promise<void> {
  for (const mock of MOCK_ACCOUNTS) {
    let account = await prisma.mailAccount.findFirst({
      where: { userId, emailAddress: mock.email },
    })

    if (!account) {
      account = await prisma.mailAccount.create({
        data: {
          id: mock.id,
          userId,
          type: "MOCK",
          emailAddress: mock.email,
          displayName: mock.displayName,
          encryptedCreds: "mock",
        },
      })
    }

    // Sync if never synced
    if (!account.lastSyncAt) {
      await syncAccount({
        id: account.id,
        type: "MOCK",
        emailAddress: account.emailAddress,
        syncCursor: account.syncCursor ?? undefined,
      })
    }
  }
}
