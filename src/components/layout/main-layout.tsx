'use client'

import { AppSidebar } from '@/components/layout/sidebar/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "14rem",
      } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  )
}