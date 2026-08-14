export function FacturaSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="animate-pulse space-y-4 rounded-lg bg-bg-surface p-8">
        <div className="mx-auto h-6 w-1/2 rounded bg-bg-elevated" />
        <div className="mx-auto h-4 w-1/3 rounded bg-bg-elevated" />
        <div className="my-4 h-px bg-border-subtle" />
        <div className="h-4 w-full rounded bg-bg-elevated" />
        <div className="h-4 w-full rounded bg-bg-elevated" />
        <div className="h-4 w-3/4 rounded bg-bg-elevated" />
        <div className="my-4 h-px bg-border-subtle" />
        <div className="h-4 w-full rounded bg-bg-elevated" />
        <div className="h-4 w-full rounded bg-bg-elevated" />
        <div className="h-4 w-1/2 rounded bg-bg-elevated" />
      </div>
    </div>
  )
}
