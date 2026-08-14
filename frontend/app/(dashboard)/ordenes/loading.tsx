export default function OrdenesLoading(): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="h-48 animate-pulse rounded-lg bg-bg-surface"
        />
      ))}
    </div>
  )
}
