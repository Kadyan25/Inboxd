# Inboxd

AI-first universal email client. Mobile-ready PWA. Unified inbox across Gmail, Outlook (stub), and IMAP (Yahoo, AOL) with Claude-powered summaries, reply drafts, and priority triage.

**Live URL:** https://inboxd-production-077c.up.railway.app

---

## What it does

- **Unified inbox** — all accounts in one view, sorted by time
- **AI summaries** — auto-generated when you open a thread
- **AI reply drafts** — 3 distinct reply strategies on demand
- **AI prioritization** — every message tagged URGENT / NORMAL / LOW / NOISE on sync
- **Compose / Reply / Forward** — full compose flow with quote threading
- **Search** — full-text across all accounts
- **Labels, Archive, Trash** — with undo toasts
- **Account switching** — Gmail, IMAP (Yahoo/AOL), Outlook stub
- **PWA** — installable, offline shell via service worker

---

## Try it

Open the live URL and sign in with Google. Your Gmail inbox loads automatically — AI features work immediately after the first sync.

To connect a Yahoo or AOL account: tap the accounts icon → Connect IMAP → select a preset.

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript strict |
| Styling | Tailwind v4 + shadcn/ui |
| Database | Postgres (Railway) via Prisma |
| Auth | NextAuth — Google provider |
| AI | Claude (`claude-sonnet-4-5` / `claude-haiku-4-5`) via Anthropic SDK |
| Email — Gmail | Gmail REST API, OAuth2 |
| Email — IMAP | imapflow + nodemailer |
| Email — Graph | Interface stub (mock data) |
| Testing | Vitest (80 tests) + Playwright |
| Deploy | Railway |

---

## Run locally

```bash
git clone https://github.com/Kadyan25/Inboxd.git
cd Inboxd
npm install
cp .env.example .env
# Fill in .env — see Environment section below
npx prisma db push
npm run dev
```

Open http://localhost:3000.

### Environment variables

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=<google cloud console>
GOOGLE_CLIENT_SECRET=<google cloud console>
ENCRYPTION_KEY=<openssl rand -hex 32>
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

### Tests

```bash
npm run test          # Vitest — 80 unit tests
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run test:e2e      # Playwright (requires npx playwright install)
```

---

## Docs

- [`CLAUDE.md`](CLAUDE.md) — project rules and Claude Code configuration
- [`architecture.md`](architecture.md) — locked technical contracts (schema, interfaces, env vars)
- [`build-plan.md`](build-plan.md) — phased build plan
- [`docs/architecture.md`](docs/architecture.md) — one-page architecture summary
- [`docs/claude-code-stack.md`](docs/claude-code-stack.md) — agents, skills, hooks, plugins
- [`docs/workflow.md`](docs/workflow.md) — Claude Code methodology writeup

---

## Project structure

```
src/
├── app/
│   ├── (auth)/           sign-in, OAuth callbacks
│   ├── (app)/            inbox, thread, compose
│   └── api/              auth, messages, ai, sync, providers
├── providers/
│   ├── types.ts          EmailProvider interface
│   ├── gmail/            GmailProvider
│   ├── imap/             ImapProvider
│   ├── graph/            GraphProvider (stub)
│   └── mock/             MockProvider + fixtures
├── services/
│   ├── ai/               gateway, claude, openai, prompts, schemas
│   └── sync.ts           sync engine
├── components/inbox/     UI components
└── lib/                  encryption, auth, db, env
```
