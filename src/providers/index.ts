import type { EmailProvider } from "@/providers/types"
import { MockProvider } from "@/providers/mock"
import { GmailProvider } from "@/providers/gmail"

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
      if (!account.encryptedCreds) throw new Error("Gmail account missing credentials")
      return new GmailProvider(account.id, account.encryptedCreds)
    case "IMAP":
      // Phase 8b
      throw new Error("IMAP provider not yet implemented")
    default: {
      const _exhaustive: never = account.type
      throw new Error(`Unknown provider type: ${_exhaustive}`)
    }
  }
}

export { MockProvider }
export type { EmailProvider }
