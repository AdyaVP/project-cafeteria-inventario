export default function FacturacionLoading(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <aside className="w-[300px] shrink-0 border-r border-border-subtle bg-bg-surface p-4">
        <div className="mb-4 h-4 w-48 animate-pulse rounded bg-bg-elevated" />
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="mb-3 h-20 animate-pulse rounded-lg bg-bg-elevated"
          />
        ))}
      </aside>
      <section className="flex-1 p-6">
        <div className="mb-6 h-8 w-56 animate-pulse rounded bg-bg-surface" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded bg-bg-surface"
            />
          ))}
        </div>
      </section>
    </div>
  )
}
