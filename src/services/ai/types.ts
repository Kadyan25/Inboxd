import type { NormalizedThread } from "@/providers/types"

export interface SummarizeInput {
  thread: NormalizedThread
  maxSentences?: number
}

export interface SummarizeOutput {
  summary: string
  keyPoints: string[]
}

export interface DraftReplyInput {
  thread: NormalizedThread
  userContext?: string
}

export interface DraftReply {
  label: string
  bodyText: string
}

export interface DraftReplyOutput {
  drafts: DraftReply[]
}

export interface PrioritizeInput {
  messages: Array<{
    providerMessageId: string
    from: { email: string; name?: string }
    subject: string | null
    snippet: string
    sentAt: Date
  }>
}

export interface PrioritizedMessage {
  providerMessageId: string
  priority: "URGENT" | "NORMAL" | "LOW" | "NOISE"
  reason: string
}

export interface PrioritizeOutput {
  results: PrioritizedMessage[]
}

export interface AIProvider {
  readonly name: "claude" | "openai" | "mock"
  summarize(input: SummarizeInput): Promise<SummarizeOutput>
  draftReplies(input: DraftReplyInput): Promise<DraftReplyOutput>
  prioritize(input: PrioritizeInput): Promise<PrioritizeOutput>
}
