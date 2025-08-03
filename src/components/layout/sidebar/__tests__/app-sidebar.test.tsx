import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AppSidebar } from '../app-sidebar'

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: any) => (
    <div data-testid="sidebar" {...props}>
      {children}
    </div>
  ),
  SidebarContent: ({ children }: any) => <div data-testid="sidebar-content">{children}</div>,
  SidebarFooter: ({ children }: any) => <div data-testid="sidebar-footer">{children}</div>,
  SidebarHeader: ({ children }: any) => <div data-testid="sidebar-header">{children}</div>,
  SidebarRail: () => <div data-testid="sidebar-rail" />,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>,
  useSidebar: () => ({ isMobile: false }),
}))

vi.mock('@/components/layout/sidebar/nav-main', () => ({
  NavMain: ({ items }: any) => (
    <div data-testid="nav-main">
      {items.map((item: any) => (
        <div key={item.title}>{item.title}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/layout/sidebar/nav-user', () => ({
  NavUser: ({ user }: any) => <div data-testid="nav-user">{user.name}</div>,
}))

vi.mock('@/components/sync/sync-status-indicator', () => ({
  SyncStatusIndicator: () => <div data-testid="sync-status">Sync Status</div>,
}))

describe('AppSidebar', () => {
  it('renders all main navigation items', () => {
    render(<AppSidebar />)

    expect(screen.getByText('タイマー')).toBeInTheDocument()
    expect(screen.getByText('プロジェクト')).toBeInTheDocument()
    expect(screen.getByText('スケジュール')).toBeInTheDocument()
    expect(screen.getByText('レポート')).toBeInTheDocument()
  })

  it('renders app name and version', () => {
    render(<AppSidebar />)

    expect(screen.getByText('ModerationCraft')).toBeInTheDocument()
    expect(screen.getByText('v1.0')).toBeInTheDocument()
  })

  it('renders sync status indicator', () => {
    render(<AppSidebar />)

    expect(screen.getByTestId('sync-status')).toBeInTheDocument()
  })

  it('renders user navigation', () => {
    render(<AppSidebar />)

    expect(screen.getByTestId('nav-user')).toBeInTheDocument()
    expect(screen.getByText('ユーザー')).toBeInTheDocument()
  })

  it('applies collapsible="icon" prop to sidebar', () => {
    render(<AppSidebar />)

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveAttribute('collapsible', 'icon')
  })
})
