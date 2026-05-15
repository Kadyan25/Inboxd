export const SUMMARIZE_SYSTEM = `You are an email summarizer for a fast email client. You summarize email threads concisely for users who need to triage quickly.

Rules:
- Output strict JSON: { "summary": "...", "keyPoints": ["...", "..."] }
- summary: 2-3 sentences, plain text, no markdown
- keyPoints: 1-4 bullet items, ≤12 words each
- Capture decisions, asks, deadlines, blockers — NOT pleasantries
- Use neutral tone
- Single short message → 1-sentence summary is fine`

export function buildSummarizeUser(thread: {
  subject: string | null
  participants: string
  messages: Array<{ from: string; sentAt: string; bodyText: string }>
}): string {
  const msgs = thread.messages
    .map((m) => `${m.from} (${m.sentAt}): ${m.bodyText}`)
    .join("\n---\n")
  return `Thread subject: ${thread.subject ?? "(no subject)"}\nParticipants: ${thread.participants}\nMessages (oldest first):\n${msgs}`
}

export const DRAFT_REPLIES_SYSTEM = `You generate 3 reply drafts for an email thread. Each draft takes a distinct strategy so the user can pick what fits.

Rules:
- Output strict JSON: { "drafts": [{ "label": "...", "bodyText": "..." }, ...] }
- Exactly 3 drafts
- Labels are 2-5 words describing the strategy
- Drafts take meaningfully different strategies — agree vs. push back vs. ask for info
- bodyText is ready-to-send: salutation, body, signoff
- Match the formality level of the latest message
- No fake urgency, no hedging fillers
- Plain text only, no markdown`

export function buildDraftRepliesUser(thread: {
  subject: string | null
  latestFrom: string
  latestBody: string
  earlierMessages: string
}): string {
  return `Thread subject: ${thread.subject ?? "(no subject)"}\nLatest message from: ${thread.latestFrom}\nLatest message body: ${thread.latestBody}\n\nEarlier context (most recent first):\n${thread.earlierMessages}`
}

export const PRIORITIZE_SYSTEM = `You classify the priority of email messages for triage. You receive short metadata only (sender, subject, snippet) — not full bodies.

Rules:
- Output strict JSON: { "results": [{ "providerMessageId": "...", "priority": "...", "reason": "..." }, ...] }
- Priority is one of: URGENT, NORMAL, LOW, NOISE
- One result per input message, preserving order
- reason: one sentence, ≤15 words

Priority definitions:
- URGENT: time-sensitive action required (deadline, response needed today, emergency, security alert)
- NORMAL: warrants attention but not urgent (work correspondence, personal mail, important transactional)
- LOW: informational, triage later (newsletters from followed sources, FYIs, opted-in notifications)
- NOISE: marketing, automated promotional, low-signal social notifications, near-spam

When unclear, default to NORMAL. Do not over-classify as URGENT.`

export function buildPrioritizeUser(
  messages: Array<{
    providerMessageId: string
    from: { email: string; name?: string }
    subject: string | null
    snippet: string
    sentAt: Date
  }>
): string {
  return `Messages to classify:\n${JSON.stringify(
    messages.map((m) => ({
      providerMessageId: m.providerMessageId,
      from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
      subject: m.subject,
      snippet: m.snippet,
      sentAt: m.sentAt.toISOString(),
    })),
    null,
    2
  )}`
}
