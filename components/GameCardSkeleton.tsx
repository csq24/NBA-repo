export function GameCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex justify-between gap-2">
        <div className="h-6 w-16 rounded-full bg-zinc-800" />
        <div className="h-4 flex-1 rounded bg-zinc-800" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 max-w-full rounded bg-zinc-800" />
            <div className="h-8 w-10 rounded bg-zinc-800" />
          </div>
        </div>
        <div className="mx-auto h-3 w-8 rounded bg-zinc-800" />
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 max-w-full rounded bg-zinc-800" />
            <div className="h-8 w-10 rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
