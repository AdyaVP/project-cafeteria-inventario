export default function DashboardLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg bg-bg-surface"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-lg bg-bg-surface"
          />
        ))}
      </div>
    </div>
  )
}
