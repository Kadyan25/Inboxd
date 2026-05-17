import type {
  EmailProvider,
  ListOpts,
  Draft,
} from "@/providers/types"
import { MockProvider } from "@/providers/mock"

// Stub: implements EmailProvider against mock Outlook fixtures.
// Swapping in real Microsoft Graph is a drop-in replacement of this file only.
export class GraphProvider implements EmailProvider {
  readonly type = "GRAPH" as const
  private mock: MockProvider

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_accountId: string) {
    // Always use acc-outlook fixtures so stub shows realistic Outlook-flavored data
    this.mock = new MockProvider("acc-outlook")
  }

  verifyConnection() { return this.mock.verifyConnection() }
  listMessages(opts?: ListOpts) { return this.mock.listMessages(opts) }
  getThread(threadId: string) { return this.mock.getThread(threadId) }
  sendMessage(draft: Draft) { return this.mock.sendMessage(draft) }
  archive(id: string) { return this.mock.archive(id) }
  trash(id: string) { return this.mock.trash(id) }
  permanentlyDelete(id: string) { return this.mock.permanentlyDelete!(id) }
  markRead(id: string, read: boolean) { return this.mock.markRead(id, read) }
  listLabels() { return this.mock.listLabels() }
  applyLabel(msgId: string, labelId: string) { return this.mock.applyLabel(msgId, labelId) }
  removeLabel(msgId: string, labelId: string) { return this.mock.removeLabel(msgId, labelId) }
  search(query: string, opts?: Pick<ListOpts, "limit" | "cursor">) { return this.mock.search(query, opts) }
  syncChanges(lastCursor: string | null) { return this.mock.syncChanges(lastCursor) }
}
