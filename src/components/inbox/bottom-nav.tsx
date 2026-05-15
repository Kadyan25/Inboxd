"use client"

import { cn } from "@/lib/utils"

type Folder = "INBOX" | "SENT" | "ARCHIVE" | "TRASH"

const TABS: { folder: Folder; label: string; icon: string }[] = [
  { folder: "INBOX",   label: "Inbox",   icon: "✉" },
  { folder: "SENT",    label: "Sent",    icon: "↗" },
  { folder: "ARCHIVE", label: "Archive", icon: "⬇" },
  { folder: "TRASH",   label: "Trash",   icon: "🗑" },
]

interface BottomNavProps {
  folder: Folder
  onSelect: (f: Folder) => void
}

export function BottomNav({ folder, onSelect }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 flex h-16 items-center border-t border-border bg-background pb-safe"
      aria-label="Inbox navigation"
    >
      {TABS.map((tab) => (
        <button
          key={tab.folder}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
            "min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            folder === tab.folder
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onSelect(tab.folder)}
          aria-current={folder === tab.folder ? "page" : undefined}
        >
          <span className="text-base leading-none" aria-hidden>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
