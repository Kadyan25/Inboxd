import Anthropic from "@anthropic-ai/sdk"
import type { AIProvider, SummarizeInput, SummarizeOutput, DraftReplyInput, DraftReplyOutput, PrioritizeInput, PrioritizeOutput } from "./types"
import { SUMMARIZE_SYSTEM, buildSummarizeUser, DRAFT_REPLIES_SYSTEM, buildDraftRepliesUser, PRIORITIZE_SYSTEM, buildPrioritizeUser } from "./prompts"
import { summarizeOutputSchema, draftReplyOutputSchema, prioritizeOutputSchema } from "./schemas"

const MODEL_QUALITY = "claude-sonnet-4-5"
const MODEL_BULK = "claude-haiku-4-5"

export class ClaudeProvider implements AIProvider {
  readonly name = "claude" as const
  private client: Anthropic

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error("ANTHROPIC_API_KEY not set")
    this.client = new Anthropic({ apiKey: key })
  }

  private async callJSON<T>(system: string, user: string, model: string, schema: { parse: (v: unknown) => T }): Promise<T> {
    const msg = await this.client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    })
    const text = msg.content.find((b) => b.type === "text")?.text ?? ""
    const json = JSON.parse(text.trim())
    return schema.parse(json)
  }

  async summarize(input: SummarizeInput): Promise<SummarizeOutput> {
    const { thread } = input
    const participantSet = new Set([
      ...thread.messages.map((m) => m.from.email),
      ...thread.messages.flatMap((m) => m.to.map((t) => t.email)),
    ])
    const participants = Array.from(participantSet).join(", ")
    const user = buildSummarizeUser({
      subject: thread.subject,
      participants,
      messages: thread.messages.map((m) => ({
        from: m.from.name ?? m.from.email,
        sentAt: m.sentAt.toLocaleDateString(),
        bodyText: (m.bodyText ?? m.snippet).slice(0, 500),
      })),
    })
    return this.callJSON(SUMMARIZE_SYSTEM, user, MODEL_QUALITY, summarizeOutputSchema)
  }

  async draftReplies(input: DraftReplyInput): Promise<DraftReplyOutput> {
    const msgs = [...input.thread.messages].reverse()
    const latest = msgs[0]
    const earlier = msgs
      .slice(1)
      .map((m) => `${m.from.name ?? m.from.email}: ${(m.bodyText ?? m.snippet).slice(0, 200)}`)
      .join("\n---\n")
    const user = buildDraftRepliesUser({
      subject: input.thread.subject,
      latestFrom: latest.from.name ?? latest.from.email,
      latestBody: (latest.bodyText ?? latest.snippet).slice(0, 500),
      earlierMessages: earlier,
    })
    return this.callJSON(DRAFT_REPLIES_SYSTEM, user, MODEL_QUALITY, draftReplyOutputSchema)
  }

  async prioritize(input: PrioritizeInput): Promise<PrioritizeOutput> {
    const user = buildPrioritizeUser(input.messages)
    return this.callJSON(PRIORITIZE_SYSTEM, user, MODEL_BULK, prioritizeOutputSchema)
  }
}
