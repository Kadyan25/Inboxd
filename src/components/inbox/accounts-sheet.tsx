"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface AccountSummary {
  id: string
  type: "GMAIL" | "IMAP" | "GRAPH"
  emailAddress: string
  displayName: string | null
  lastSyncAt: string | null
}

interface AccountsSheetProps {
  accounts: AccountSummary[]
  onClose: () => void
}

const IMAP_PRESETS: Record<string, { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }> = {
  "Yahoo":   { imapHost: "imap.mail.yahoo.com",  imapPort: 993, smtpHost: "smtp.mail.yahoo.com", smtpPort: 465 },
  "AOL":     { imapHost: "imap.aol.com",          imapPort: 993, smtpHost: "smtp.aol.com",         smtpPort: 465 },
  "Outlook": { imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com",   smtpPort: 587 },
  "iCloud":  { imapHost: "imap.mail.me.com",      imapPort: 993, smtpHost: "smtp.mail.me.com",     smtpPort: 587 },
}

type View = "list" | "imap-form" | "connecting"

export function AccountsSheet({ accounts, onClose }: AccountsSheetProps) {
  const router = useRouter()
  const [view, setView] = useState<View>("list")
  const [imapPreset, setImapPreset] = useState("Yahoo")
  const [form, setForm] = useState({
    email: "",
    password: "",
    imapHost: IMAP_PRESETS["Yahoo"].imapHost,
    imapPort: IMAP_PRESETS["Yahoo"].imapPort,
    smtpHost: IMAP_PRESETS["Yahoo"].smtpHost,
    smtpPort: IMAP_PRESETS["Yahoo"].smtpPort,
  })
  const [connecting, setConnecting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function applyPreset(name: string) {
    setImapPreset(name)
    const p = IMAP_PRESETS[name]
    if (p) setForm((f) => ({ ...f, ...p }))
  }

  async function connectOutlook() {
    setConnecting(true)
    try {
      const res = await fetch("/api/providers/connect-graph", { method: "POST" })
      if (!res.ok) throw new Error("Failed to connect")
      toast.success("Outlook (Demo) connected")
      router.refresh()
      onClose()
    } catch {
      toast.error("Failed to connect Outlook")
    } finally {
      setConnecting(false)
    }
  }

  async function connectImap(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setConnecting(true)
    try {
      const res = await fetch("/api/providers/connect-imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.reason ?? data.error ?? "Connection failed")
        return
      }
      toast.success(`${form.email} connected`)
      router.refresh()
      onClose()
    } catch {
      setFormError("Network error — check your connection")
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect(accountId: string, email: string) {
    await fetch("/api/providers/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    })
    toast.success(`${email} disconnected`)
    router.refresh()
    onClose()
  }

  const typeLabel: Record<string, string> = {
    GMAIL: "Gmail",
    IMAP: "IMAP",
    GRAPH: "Outlook",
  }

  const typeBadgeClass: Record<string, string> = {
    GMAIL: "bg-red-100 text-red-700",
    IMAP: "bg-violet-100 text-violet-700",
    GRAPH: "bg-blue-100 text-blue-700",
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[85svh] overflow-y-auto rounded-t-2xl bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {view === "list" && (
          <div className="px-4 pb-8">
            <h2 className="mb-4 text-base font-semibold">Accounts</h2>

            {accounts.length === 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">No accounts connected yet.</p>
            ) : (
              <ul className="mb-6 space-y-2">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{a.displayName ?? a.emailAddress}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.emailAddress}</p>
                    </div>
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-medium", typeBadgeClass[a.type])}>
                      {typeLabel[a.type]}
                      {a.type === "GRAPH" && " (stub)"}
                    </span>
                    <button
                      onClick={() => disconnect(a.id, a.emailAddress)}
                      className="shrink-0 text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mb-6 border-t border-border pt-4">
              <button
                onClick={() => signOut({ callbackUrl: "/sign-in" })}
                className="text-sm text-destructive hover:underline"
              >
                Sign out
              </button>
            </div>

            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add account</p>
            <div className="space-y-2">
              <button
                onClick={() => setView("imap-form")}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-xl">✉</span>
                <div>
                  <p className="text-sm font-medium">Yahoo / AOL / IMAP</p>
                  <p className="text-xs text-muted-foreground">Connect with an app password</p>
                </div>
              </button>
              <button
                onClick={connectOutlook}
                disabled={connecting}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <span className="text-xl">🪟</span>
                <div>
                  <p className="text-sm font-medium">Outlook / Microsoft</p>
                  <p className="text-xs text-muted-foreground">Demo mode — mock data shown</p>
                </div>
                <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  Stub
                </span>
              </button>
            </div>
          </div>
        )}

        {view === "imap-form" && (
          <form onSubmit={connectImap} className="px-4 pb-8">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView("list")}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
              <h2 className="text-base font-semibold">Connect IMAP account</h2>
            </div>

            {/* Presets */}
            <div className="mb-4 flex gap-1.5 flex-wrap">
              {Object.keys(IMAP_PRESETS).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyPreset(name)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    imapPreset === name
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@yahoo.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">App password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="16-character app password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate at: Yahoo Account Security → App passwords
                </p>
              </div>

              {/* Advanced — host/port */}
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">Advanced (IMAP / SMTP settings)</summary>
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">IMAP host</label>
                      <input
                        value={form.imapHost}
                        onChange={(e) => setForm((f) => ({ ...f, imapHost: e.target.value }))}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Port</label>
                      <input
                        type="number"
                        value={form.imapPort}
                        onChange={(e) => setForm((f) => ({ ...f, imapPort: Number(e.target.value) }))}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">SMTP host</label>
                      <input
                        value={form.smtpHost}
                        onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Port</label>
                      <input
                        type="number"
                        value={form.smtpPort}
                        onChange={(e) => setForm((f) => ({ ...f, smtpPort: Number(e.target.value) }))}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              </details>

              {formError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{formError}</p>
              )}

              <button
                type="submit"
                disabled={connecting}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Test & connect"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
