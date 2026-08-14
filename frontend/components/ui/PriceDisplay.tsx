import clsx from 'clsx'
interface PriceDisplayProps {
  amount: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'accent'
  showPrefix?: boolean
}
const sizes: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl font-bold',
}
export function PriceDisplay({
  amount,
  size = 'md',
  variant = 'default',
  showPrefix = true,
}: PriceDisplayProps): React.JSX.Element {
  return (
    <span
      className={clsx(
        'font-mono',
        sizes[size],
        variant === 'accent' ? 'text-accent' : 'text-text-primary'
      )}
    >
      {showPrefix && <span className="mr-1 text-text-secondary">L.</span>}
      {amount.toLocaleString('es-HN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  )
}
