"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface ComposePrefill {
  to?: string
  subject?: string
  body?: string
  threadId?: string
  inReplyTo?: string
}

interface ComposeSheetProps {
  mailAccountId: string
  mode: "compose" | "reply" | "forward"
  prefill?: ComposePrefill
  onClose: () => void
  onSent?: () => void
}

const emailSchema = z.string().email()

function parseAddresses(raw: string) {
  return raw
    .split(",")
    .map((s) => ({ email: s.trim() }))
    .filter((a) => a.email)
}

function validateEmailField(raw: string): string | null {
  if (!raw.trim()) return "Required"
  for (const addr of parseAddresses(raw)) {
    if (!emailSchema.safeParse(addr.email).success) return `Invalid email: ${addr.email}`
  }
  return null
}

const TITLES = { compose: "New message", reply: "Reply", forward: "Forward" }

export function ComposeSheet({ mailAccountId, mode, prefill, onClose, onSent }: ComposeSheetProps) {
  const [to, setTo] = useState(prefill?.to ?? "")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState(prefill?.subject ?? "")
  const [body, setBody] = useState(prefill?.body ?? "")
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [toError, setToError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setTo(prefill?.to ?? "")
    setSubject(prefill?.subject ?? "")
    setBody(prefill?.body ?? "")
  }, [prefill])

  async function handleSend() {
    const toErr = validateEmailField(to)
    if (toErr) {
      setToError(toErr)
      return
    }
    setToError(null)
    setSending(true)

    const payload = {
      mailAccountId,
      to: parseAddresses(to),
      ...(cc.trim() ? { cc: parseAddresses(cc) } : {}),
      ...(bcc.trim() ? { bcc: parseAddresses(bcc) } : {}),
      subject: subject.trim() || "(no subject)",
      bodyText: body,
      ...(prefill?.inReplyTo ? { inReplyTo: prefill.inReplyTo } : {}),
      ...(prefill?.threadId ? { threadId: prefill.threadId } : {}),
    }

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("send failed")
      toast.success("Message sent")
      onSent?.()
      onClose()
    } catch {
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="flex h-[100svh] flex-col p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-left text-base">{TITLES[mode]}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border">
            {/* To */}
            <div className="flex items-center border-b border-border px-4">
              <span className="w-8 shrink-0 text-xs text-muted-foreground">To</span>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@example.com"
                className="flex-1 border-0 bg-transparent px-2 py-3 text-sm shadow-none focus-visible:ring-0"
              />
              <div className="flex gap-2 text-xs text-muted-foreground">
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)}>
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button type="button" onClick={() => setShowBcc(true)}>
                    Bcc
                  </button>
                )}
              </div>
            </div>
            {toError && <p className="px-4 pb-1 text-xs text-destructive">{toError}</p>}

            {/* Cc */}
            {showCc && (
              <div className="flex items-center border-b border-border px-4">
                <span className="w-8 shrink-0 text-xs text-muted-foreground">Cc</span>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 border-0 bg-transparent px-2 py-3 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            )}

            {/* Bcc */}
            {showBcc && (
              <div className="flex items-center border-b border-border px-4">
                <span className="w-8 shrink-0 text-xs text-muted-foreground">Bcc</span>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 border-0 bg-transparent px-2 py-3 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center px-4">
              <span className="w-8 shrink-0 text-xs text-muted-foreground">Sub</span>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 border-0 bg-transparent px-2 py-3 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="border-t border-border px-4 py-3 pb-safe">
          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
