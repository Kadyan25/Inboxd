"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { PriorityBadge } from "./priority-badge"
import type { MessageSummary } from "@/lib/hooks/use-messages"

interface MessageRowProps {
  message: MessageSummary
  onClick: () => void
  onArchive: () => void
}

export function MessageRow({ message, onClick, onArchive }: MessageRowProps) {
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef(0)
  const el = useRef<HTMLDivElement>(null)

  const sentAt = new Date(message.sentAt)
  const timeLabel = formatTime(sentAt)
  const senderName = message.fromName || message.fromAddress.split("@")[0]

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    setSwiping(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientX - startX.current
    // Only allow leftward swipe (archive)
    if (delta < 0) setOffset(Math.max(delta, -120))
  }

  function handleTouchEnd() {
    setSwiping(false)
    if (offset < -80) {
      onArchive()
    } else {
      setOffset(0)
    }
  }

  const archiveRevealed = offset < -40

  return (
    <div className="relative overflow-hidden">
      {/* Archive action revealed behind the row */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-green-500 transition-opacity",
          archiveRevealed ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="text-xs font-medium text-white">Archive</span>
      </div>

      <div
        ref={el}
        role="button"
        tabIndex={0}
        aria-label={`Email from ${senderName}: ${message.subject ?? "(no subject)"}`}
        className={cn(
          "flex min-h-[64px] cursor-pointer select-none items-start gap-3 border-b border-border px-4 py-3",
          "active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !message.isRead && "bg-blue-50/40"
        )}
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? "none" : "transform 0.2s ease",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {/* Unread dot */}
        <div className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center">
          {!message.isRead && (
            <div className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", !message.isRead ? "font-semibold" : "font-medium")}>
              {senderName}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{timeLabel}</span>
          </div>

          <p className={cn("truncate text-sm", !message.isRead ? "font-medium text-foreground" : "text-muted-foreground")}>
            {message.subject ?? "(no subject)"}
          </p>

          <div className="mt-0.5 flex items-center gap-2">
            <p className="truncate text-xs text-muted-foreground">{message.snippet}</p>
            <PriorityBadge priority={message.aiPriority} />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" })
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}
