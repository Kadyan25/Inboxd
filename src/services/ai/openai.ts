import OpenAI from "openai"
import type { AIProvider, SummarizeInput, SummarizeOutput, DraftReplyInput, DraftReplyOutput, PrioritizeInput, PrioritizeOutput } from "./types"
import { SUMMARIZE_SYSTEM, buildSummarizeUser, DRAFT_REPLIES_SYSTEM, buildDraftRepliesUser, PRIORITIZE_SYSTEM, buildPrioritizeUser } from "./prompts"
import { summarizeOutputSchema, draftReplyOutputSchema, prioritizeOutputSchema } from "./schemas"

const MODEL_QUALITY = "gpt-4o"
const MODEL_BULK = "gpt-4o-mini"

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const
  private client: OpenAI

  constructor() {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error("OPENAI_API_KEY not set")
    this.client = new OpenAI({ apiKey: key })
  }

  private async callJSON<T>(system: string, user: string, model: string, schema: { parse: (v: unknown) => T }): Promise<T> {
    const res = await this.client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    })
    const text = res.choices[0]?.message.content ?? ""
    const json = JSON.parse(text)
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
