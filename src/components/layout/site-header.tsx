'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

interface SiteHeaderProps {
  title?: string
  children?: React.ReactNode
  className?: string
}

export function SiteHeader({ title, children, className }: SiteHeaderProps) {
  return (
    <header className={cn(
      "flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear",
      "group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12",
      "border-b border-border",
      className
    )}>
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {title && (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">
                  {title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      {children && (
        <div className="ml-auto flex items-center gap-2 px-4">
          {children}
        </div>
      )}
    </header>
  )
}