import { cn } from "@/lib/utils"

const CONFIG = {
  URGENT: { label: "Urgent", className: "bg-red-100 text-red-700 border-red-200" },
  NORMAL: { label: "Normal", className: "bg-blue-100 text-blue-700 border-blue-200" },
  LOW:    { label: "Low",    className: "bg-gray-100 text-gray-600 border-gray-200" },
  NOISE:  { label: "Noise",  className: "bg-gray-50  text-gray-400 border-gray-100" },
} as const

type Priority = keyof typeof CONFIG

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority || !(priority in CONFIG)) return null
  const { label, className } = CONFIG[priority as Priority]
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium", className)}>
      {label}
    </span>
  )
}
