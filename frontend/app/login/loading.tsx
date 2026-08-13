export default function LoginLoading(): React.JSX.Element {
  return (
    <main className="flex h-screen bg-bg-base">
      <section className="flex w-full shrink-0 items-center bg-bg-base px-8 sm:px-12 md:w-[40%] lg:px-[7.5vw]">
        <div className="w-full max-w-[300px] space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-md bg-bg-elevated"
            />
          ))}
        </div>
      </section>
      <section className="hidden flex-1 animate-pulse bg-bg-elevated md:block" />
    </main>
  )
}
