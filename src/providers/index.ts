import type { EmailProvider } from "@/providers/types"
import { MockProvider } from "@/providers/mock"

export interface ProviderAccount {
  id: string
  type: "GMAIL" | "IMAP" | "GRAPH" | "MOCK"
  emailAddress: string
  encryptedCreds?: string
  imapHost?: string | null
  imapPort?: number | null
  smtpHost?: string | null
  smtpPort?: number | null
  syncCursor?: string
}

export function getProvider(account: ProviderAccount): EmailProvider {
  switch (account.type) {
    case "MOCK":
      return new MockProvider(account.id)
    case "GRAPH":
      // Graph stub delegates to mock (v1)
      return new MockProvider(account.id)
    case "GMAIL":
    case "IMAP":
      // Implemented in Phase 8a/8b
      throw new Error(`Provider ${account.type} not yet implemented`)
    default: {
      const _exhaustive: never = account.type
      throw new Error(`Unknown provider type: ${_exhaustive}`)
    }
  }
}

export { MockProvider }
export type { EmailProvider }
