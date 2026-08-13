export default function CocinaLoading(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-bg-base p-4">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, column) => (
          <section key={column}>
            <div className="mb-3 h-5 w-32 animate-pulse rounded bg-bg-surface" />
            <div className="space-y-3">
              {Array.from({ length: 2 }, (_, card) => (
                <div
                  key={card}
                  className="h-48 animate-pulse rounded-lg bg-bg-surface"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
