export default function MesasLoading(): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-lg bg-bg-surface"
        />
      ))}
    </div>
  )
}
