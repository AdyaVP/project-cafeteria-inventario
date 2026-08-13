import type { ReactNode } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
interface DashboardLayoutProps {
  children: ReactNode
}
export default function DashboardLayout({
  children,
}: DashboardLayoutProps): React.JSX.Element {
  return <AppLayout>{children}</AppLayout>
}
