import type { NormalizedMessage, NormalizedLabel } from "@/providers/types"

// Three mock accounts
export const MOCK_ACCOUNTS = [
  { id: "acc-gmail", email: "alex.morgan@gmail.com", displayName: "Alex (Gmail)" },
  { id: "acc-outlook", email: "alex.morgan@outlook.com", displayName: "Alex (Outlook)" },
  { id: "acc-yahoo", email: "amorgan@yahoo.com", displayName: "Alex (Yahoo)" },
]

// Thread IDs for multi-message threads
const T = {
  projectKickoff: "thread-project-kickoff",
  releaseReview:  "thread-release-review",
  onboarding:     "thread-onboarding",
  invoiceChase:   "thread-invoice-chase",
}

function msg(
  id: string,
  threadId: string,
  from: { email: string; name?: string },
  to: { email: string; name?: string }[],
  subject: string,
  bodyText: string,
  sentAt: Date,
  opts: Partial<NormalizedMessage> = {}
): NormalizedMessage {
  return {
    providerMessageId: id,
    threadId,
    from,
    to,
    cc: [],
    bcc: [],
    subject,
    bodyText,
    bodyHtml: `<p>${bodyText.replace(/\n/g, "</p><p>")}</p>`,
    snippet: bodyText.slice(0, 150),
    sentAt,
    isRead: false,
    isStarred: false,
    folder: "INBOX",
    providerMeta: {},
    ...opts,
  }
}

const now = new Date("2026-05-15T10:00:00Z")
const h = (n: number) => new Date(now.getTime() - n * 3_600_000)

// ─── Account 1 (Gmail) messages ──────────────────────────────
export const GMAIL_MESSAGES: NormalizedMessage[] = [
  // Thread 1 — project kickoff (3 messages)
  msg(
    "g-1", T.projectKickoff,
    { email: "sarah.chen@acme.com", name: "Sarah Chen" },
    [{ email: "alex.morgan@gmail.com", name: "Alex" }],
    "Project kickoff — Q3 roadmap",
    "Hey Alex,\n\nLet's kick off the Q3 roadmap planning session. Can you join Thursday at 2pm? We'll cover scope, timelines, and owner assignments.\n\nSarah",
    h(48), { isRead: true }
  ),
  msg(
    "g-2", T.projectKickoff,
    { email: "alex.morgan@gmail.com", name: "Alex" },
    [{ email: "sarah.chen@acme.com", name: "Sarah Chen" }],
    "Re: Project kickoff — Q3 roadmap",
    "Thursday at 2pm works for me. Should I prepare anything beforehand?\n\nAlex",
    h(46), { isRead: true, folder: "SENT" }
  ),
  msg(
    "g-3", T.projectKickoff,
    { email: "sarah.chen@acme.com", name: "Sarah Chen" },
    [{ email: "alex.morgan@gmail.com", name: "Alex" }],
    "Re: Project kickoff — Q3 roadmap",
    "Just bring your current task list and any blockers you're aware of. See you Thursday!\n\nSarah",
    h(44)
  ),

  // Thread 2 — release review (2 messages)
  msg(
    "g-4", T.releaseReview,
    { email: "dev-lead@acme.com", name: "Dev Lead" },
    [{ email: "alex.morgan@gmail.com" }],
    "URGENT: v2.4 release review needed by EOD",
    "Alex — we need sign-off on the v2.4 release notes before EOD today. Please review the attached diff and confirm no regressions in your area.\n\nThanks",
    h(2)
  ),
  msg(
    "g-5", T.releaseReview,
    { email: "qa@acme.com", name: "QA Team" },
    [{ email: "alex.morgan@gmail.com" }, { email: "dev-lead@acme.com" }],
    "Re: URGENT: v2.4 release review needed by EOD",
    "QA passed all regression suites. Waiting on Alex's sign-off to proceed.",
    h(1)
  ),

  // Single messages
  msg(
    "g-6", "thread-g-6",
    { email: "noreply@github.com", name: "GitHub" },
    [{ email: "alex.morgan@gmail.com" }],
    "[acme/backend] Pull request merged: Fix connection pool leak",
    "Your pull request #847 was merged into main by sarah-chen.",
    h(3), { isRead: true }
  ),
  msg(
    "g-7", "thread-g-7",
    { email: "newsletter@techdigest.io", name: "Tech Digest" },
    [{ email: "alex.morgan@gmail.com" }],
    "This week in tech: AI chips, open source LLMs, and more",
    "Your weekly roundup of the most important stories in technology...",
    h(5), { isRead: true }
  ),
  msg(
    "g-8", "thread-g-8",
    { email: "hr@acme.com", name: "ACME HR" },
    [{ email: "alex.morgan@gmail.com" }],
    "Q2 performance review scheduled",
    "Hi Alex, your Q2 performance review is scheduled for May 20th at 3pm with your manager. Please complete the self-assessment form by May 18th.",
    h(6)
  ),
  msg(
    "g-9", "thread-g-9",
    { email: "security-alerts@google.com", name: "Google" },
    [{ email: "alex.morgan@gmail.com" }],
    "New sign-in to your account from Chrome on Windows",
    "We noticed a new sign-in to your Google Account from Chrome on Windows. If this was you, you don't need to do anything.",
    h(8), { isRead: true }
  ),
  msg(
    "g-10", "thread-g-10",
    { email: "promos@amazon.com", name: "Amazon" },
    [{ email: "alex.morgan@gmail.com" }],
    "Flash sale: Up to 50% off electronics today only",
    "Don't miss out! Deals expire midnight. Shop now for huge savings on laptops, tablets, and more.",
    h(10), { isRead: true }
  ),
]

// ─── Account 2 (Outlook) messages ─────────────────────────────
export const OUTLOOK_MESSAGES: NormalizedMessage[] = [
  // Thread 3 — onboarding (2 messages)
  msg(
    "o-1", T.onboarding,
    { email: "onboarding@acme.com", name: "ACME Onboarding" },
    [{ email: "alex.morgan@outlook.com" }],
    "Welcome to ACME — your onboarding checklist",
    "Welcome Alex! Here's your onboarding checklist for your first two weeks:\n\n1. Set up your development environment\n2. Complete security training by Friday\n3. Meet with your manager on Day 3\n4. Join the #engineering Slack channel\n\nLet us know if you need anything!",
    h(72), { isRead: true }
  ),
  msg(
    "o-2", T.onboarding,
    { email: "manager@acme.com", name: "Jamie Rodriguez" },
    [{ email: "alex.morgan@outlook.com" }],
    "Re: Welcome to ACME — your onboarding checklist",
    "Hey Alex! Looking forward to our Day 3 chat. Feel free to reach out with any questions before then. We're glad to have you on the team.",
    h(70), { isRead: true }
  ),

  msg(
    "o-3", "thread-o-3",
    { email: "billing@acme.com", name: "ACME Billing" },
    [{ email: "alex.morgan@outlook.com" }],
    "Invoice #2941 due in 3 days",
    "Reminder: Invoice #2941 for $1,250.00 is due on May 18th. Please process payment to avoid late fees.",
    h(4)
  ),
  msg(
    "o-4", "thread-o-4",
    { email: "team@figma.com", name: "Figma" },
    [{ email: "alex.morgan@outlook.com" }],
    "Sarah shared a file with you: Q3 Design System",
    "Sarah Chen has shared the file 'Q3 Design System' with you in Figma. Click to view.",
    h(7)
  ),
  msg(
    "o-5", "thread-o-5",
    { email: "alerts@pagerduty.com", name: "PagerDuty" },
    [{ email: "alex.morgan@outlook.com" }],
    "RESOLVED: High error rate on api-gateway",
    "Incident INC-4421 has been resolved. Duration: 12 minutes. Post-mortem scheduled for Friday.",
    h(9), { isRead: true }
  ),
  msg(
    "o-6", "thread-o-6",
    { email: "newsletter@hackernews.email", name: "Hacker News Digest" },
    [{ email: "alex.morgan@outlook.com" }],
    "Top HN stories: WebAssembly, Rust in Linux, and SQLite",
    "Today's top stories from Hacker News. Click to read.",
    h(12), { isRead: true }
  ),
  msg(
    "o-7", "thread-o-7",
    { email: "recruiter@bigtech.com", name: "Taylor Kim" },
    [{ email: "alex.morgan@outlook.com" }],
    "Exciting senior engineer opportunity at BigTech",
    "Hi Alex, I came across your profile and think you'd be a great fit for a senior engineer role on our infrastructure team. Would you be open to a 15-minute call?",
    h(14)
  ),
  msg(
    "o-8", "thread-o-8",
    { email: "noreply@linear.app", name: "Linear" },
    [{ email: "alex.morgan@outlook.com" }],
    "You were assigned: ENG-1204 — Migrate auth service to Postgres",
    "Sarah Chen assigned you to ENG-1204. Due date: May 22nd.",
    h(16)
  ),
  msg(
    "o-9", "thread-o-9",
    { email: "offers@netflix.com", name: "Netflix" },
    [{ email: "alex.morgan@outlook.com" }],
    "New arrivals this week on Netflix",
    "Check out what's new this week: new seasons, movies, and originals added just for you.",
    h(18), { isRead: true }
  ),
  msg(
    "o-10", "thread-o-10",
    { email: "support@dropbox.com", name: "Dropbox" },
    [{ email: "alex.morgan@outlook.com" }],
    "Your storage is 85% full",
    "You're using 8.5 GB of your 10 GB Dropbox plan. Upgrade to keep syncing without interruptions.",
    h(20)
  ),
]

// ─── Account 3 (Yahoo) messages ──────────────────────────────
export const YAHOO_MESSAGES: NormalizedMessage[] = [
  // Thread 4 — invoice chase (2 messages)
  msg(
    "y-1", T.invoiceChase,
    { email: "client@startupco.com", name: "Dana Park" },
    [{ email: "amorgan@yahoo.com" }],
    "Invoice 1087 — payment status?",
    "Hi Alex, just following up on Invoice 1087 ($3,400) sent three weeks ago. Could you let me know the payment status? Thanks, Dana",
    h(26)
  ),
  msg(
    "y-2", T.invoiceChase,
    { email: "accounts@startupco.com", name: "StartupCo Accounts" },
    [{ email: "amorgan@yahoo.com" }, { email: "client@startupco.com" }],
    "Re: Invoice 1087 — payment status?",
    "Hi Alex, I'm copying in our accounts team. We show Invoice 1087 as pending approval in our system. Should be processed by end of week.",
    h(24)
  ),

  msg(
    "y-3", "thread-y-3",
    { email: "mom@family.com", name: "Mom" },
    [{ email: "amorgan@yahoo.com" }],
    "Thanksgiving dinner plans",
    "Hi honey! Are you coming home for Thanksgiving this year? Dad and I are hoping to have everyone together. Let us know soon so I can plan the food! Love, Mom",
    h(30)
  ),
  msg(
    "y-4", "thread-y-4",
    { email: "dentist@healthclinic.com", name: "Health Clinic" },
    [{ email: "amorgan@yahoo.com" }],
    "Appointment reminder: May 20th at 9:00 AM",
    "This is a reminder for your dental checkup on May 20th at 9:00 AM at Health Clinic. Please arrive 10 minutes early.",
    h(32)
  ),
  msg(
    "y-5", "thread-y-5",
    { email: "promo@bestbuy.com", name: "Best Buy" },
    [{ email: "amorgan@yahoo.com" }],
    "Deal of the Day: 40% off laptops",
    "Today only — massive savings on top laptop brands. Don't miss these limited-time deals.",
    h(34), { isRead: true }
  ),
  msg(
    "y-6", "thread-y-6",
    { email: "noreply@notion.so", name: "Notion" },
    [{ email: "amorgan@yahoo.com" }],
    "Jamie Rodriguez invited you to ACME Engineering workspace",
    "Jamie Rodriguez has invited you to join the ACME Engineering workspace on Notion. Accept the invitation to get started.",
    h(36)
  ),
  msg(
    "y-7", "thread-y-7",
    { email: "alerts@bankofamerica.com", name: "Bank of America" },
    [{ email: "amorgan@yahoo.com" }],
    "Large transaction alert: $1,250.00",
    "A transaction of $1,250.00 was made on your account ending in 4821. If you did not authorize this, contact us immediately.",
    h(38)
  ),
  msg(
    "y-8", "thread-y-8",
    { email: "friend@personal.com", name: "Chris Taylor" },
    [{ email: "amorgan@yahoo.com" }],
    "Weekend hiking trip?",
    "Hey! A few of us are planning a hike up Mt. Tam on Saturday. Want to join? We'd leave from the Pantoll trailhead at 8am.",
    h(40)
  ),
  msg(
    "y-9", "thread-y-9",
    { email: "shipping@shopify.com", name: "Order Confirmation" },
    [{ email: "amorgan@yahoo.com" }],
    "Your order has shipped — arrives May 17th",
    "Great news! Your order #ORD-88291 has shipped and will arrive by May 17th. Track your package using the link below.",
    h(42), { isRead: true }
  ),
  msg(
    "y-10", "thread-y-10",
    { email: "digest@producthunt.com", name: "Product Hunt" },
    [{ email: "amorgan@yahoo.com" }],
    "Today's top products: AI writing tools, dev utilities",
    "The best new products launched today. Vote for your favorites.",
    h(44), { isRead: true }
  ),
]

export const ALL_MESSAGES_BY_ACCOUNT: Record<string, NormalizedMessage[]> = {
  "acc-gmail":   GMAIL_MESSAGES,
  "acc-outlook": OUTLOOK_MESSAGES,
  "acc-yahoo":   YAHOO_MESSAGES,
}

export const MOCK_LABELS: NormalizedLabel[] = [
  { providerLabelId: "INBOX",    name: "Inbox",    isSystem: true },
  { providerLabelId: "SENT",     name: "Sent",     isSystem: true },
  { providerLabelId: "ARCHIVE",  name: "Archive",  isSystem: true },
  { providerLabelId: "TRASH",    name: "Trash",    isSystem: true },
  { providerLabelId: "STARRED",  name: "Starred",  isSystem: true },
  { providerLabelId: "IMPORTANT",name: "Important",isSystem: false, color: "#f59e0b" },
  { providerLabelId: "WORK",     name: "Work",     isSystem: false, color: "#3b82f6" },
  { providerLabelId: "PERSONAL", name: "Personal", isSystem: false, color: "#10b981" },
]
