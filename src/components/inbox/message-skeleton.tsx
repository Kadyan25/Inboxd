import { Skeleton } from "@/components/ui/skeleton"

export function MessageSkeleton() {
  return (
    <div className="flex min-h-[64px] items-start gap-3 border-b border-border px-4 py-3">
      <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
      </div>
    </div>
  )
}

export function MessageListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </>
  )
}
