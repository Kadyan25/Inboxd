import type { EmailProvider } from "@/providers/types"
import { MockProvider } from "@/providers/mock"
import { GmailProvider } from "@/providers/gmail"
import { GraphProvider } from "@/providers/graph"
import { ImapProvider } from "@/providers/imap"

export interface ProviderAccount {
  id: string
  type: "GMAIL" | "IMAP" | "GRAPH" | "MOCK"
  emailAddress: string
  encryptedCreds?: string | null
  imapHost?: string | null
  imapPort?: number | null
  smtpHost?: string | null
  smtpPort?: number | null
  syncCursor?: string | null
}

export function getProvider(account: ProviderAccount): EmailProvider {
  switch (account.type) {
    case "MOCK":
      return new MockProvider(account.id)
    case "GRAPH":
      return new GraphProvider(account.id)
    case "GMAIL":
      if (!account.encryptedCreds) throw new Error("Gmail account missing credentials")
      return new GmailProvider(account.id, account.encryptedCreds)
    case "IMAP": {
      if (!account.encryptedCreds) throw new Error("IMAP account missing credentials")
      if (!account.imapHost || !account.imapPort || !account.smtpHost || !account.smtpPort) {
        throw new Error("IMAP account missing host/port configuration")
      }
      return new ImapProvider(
        account.id,
        account.encryptedCreds,
        account.imapHost,
        account.imapPort,
        account.smtpHost,
        account.smtpPort
      )
    }
    default: {
      const _exhaustive: never = account.type
      throw new Error(`Unknown provider type: ${_exhaustive}`)
    }
  }
}

export { MockProvider }
export type { EmailProvider }
