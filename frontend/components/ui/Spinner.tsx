import clsx from 'clsx'
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}
const sizes: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
}
export function Spinner({
  size = 'md',
  className,
}: SpinnerProps): React.JSX.Element {
  return (
    <svg
      aria-label="Cargando"
      className={clsx('animate-spin', sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="stroke-bg-elevated"
        cx="12"
        cy="12"
        r="9"
        strokeWidth="3"
      />
      <path
        className="stroke-accent"
        d="M12 3a9 9 0 0 1 9 9"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  )
}
