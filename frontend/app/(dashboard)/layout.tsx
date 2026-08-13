import type { ReactNode } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { ReadyOrdersProvider } from '@/lib/context/ReadyOrdersContext'
interface DashboardLayoutProps {
  children: ReactNode
}
export default function DashboardLayout({
  children,
}: DashboardLayoutProps): React.JSX.Element {
  return (
    <ReadyOrdersProvider>
      <AppLayout>{children}</AppLayout>
    </ReadyOrdersProvider>
  )
}
