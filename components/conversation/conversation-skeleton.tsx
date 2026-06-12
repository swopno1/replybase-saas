import { Skeleton } from "@/components/ui/skeleton";

function MessageBubbleSkeleton({ align }: { align: "left" | "right" }) {
  const isRight = align === "right";
  return (
    <div className={`flex items-end gap-2 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className={`flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
        <Skeleton className="h-3 w-20" />
        <Skeleton
          className={`h-10 rounded-2xl ${isRight ? "rounded-br-sm" : "rounded-bl-sm"}`}
          style={{ width: `${Math.floor(Math.random() * 80) + 120}px` }}
        />
      </div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header skeleton */}
      <div className="p-4 border-b flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Message feed skeleton */}
      <div className="min-h-0 flex-1 overflow-hidden p-4 space-y-4">
        <MessageBubbleSkeleton align="left" />
        <MessageBubbleSkeleton align="right" />
        <MessageBubbleSkeleton align="left" />
        <MessageBubbleSkeleton align="right" />
        <MessageBubbleSkeleton align="left" />
      </div>

      {/* Composer skeleton */}
      <div className="p-4 border-t space-y-3">
        <Skeleton className="h-20 w-full rounded-md" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-36 rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
