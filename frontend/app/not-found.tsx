import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { DASHBOARD_ROUTE } from '@/lib/constants'
export default function NotFound(): React.JSX.Element {
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-bg-base">
      <p className="font-mono text-8xl font-bold text-accent">404</p>
      <h1 className="mt-4 text-xl text-text-primary">Página no encontrada</h1>
      <p className="mt-2 text-sm text-text-secondary">
        La ruta que buscas no existe en Comanda.
      </p>
      <Link href={DASHBOARD_ROUTE} className="mt-8">
        <Button>Ir al inicio</Button>
      </Link>
    </main>
  )
}
