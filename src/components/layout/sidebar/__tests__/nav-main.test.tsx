import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { NavMain } from '../nav-main'
import { usePathname } from 'next/navigation'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarGroup: ({ children }: any) => <div data-testid="sidebar-group">{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div data-testid="sidebar-group-label">{children}</div>,
  SidebarMenu: ({ children }: any) => <div data-testid="sidebar-menu">{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div data-testid="sidebar-menu-item">{children}</div>,
  SidebarMenuButton: ({ children, isActive, tooltip, asChild }: any) => {
    const Component = asChild ? 'div' : 'button'
    return (
      <Component data-testid="sidebar-menu-button" data-active={isActive} title={tooltip}>
        {children}
      </Component>
    )
  },
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

import type { NavItem } from '../types'

const MockIcon = () => <span>MockIcon</span>

const mockItems: NavItem[] = [
  {
    title: 'タイマー',
    url: '/timer',
    icon: MockIcon as any,
  },
  {
    title: 'プロジェクト',
    url: '/projects',
    icon: MockIcon as any,
  },
]

describe('NavMain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders menu label', () => {
    ;(usePathname as any).mockReturnValue('/projects')
    render(<NavMain items={mockItems} />)
    
    expect(screen.getByText('メニュー')).toBeInTheDocument()
  })

  it('renders all navigation items', () => {
    ;(usePathname as any).mockReturnValue('/projects')
    render(<NavMain items={mockItems} />)
    
    expect(screen.getByText('タイマー')).toBeInTheDocument()
    expect(screen.getByText('プロジェクト')).toBeInTheDocument()
  })

  it('renders icons when provided', () => {
    ;(usePathname as any).mockReturnValue('/projects')
    render(<NavMain items={mockItems} />)
    
    expect(screen.getAllByText('MockIcon')).toHaveLength(2)
  })

  it('marks correct item as active based on pathname', () => {
    ;(usePathname as any).mockReturnValue('/projects')
    render(<NavMain items={mockItems} />)
    
    const buttons = screen.getAllByTestId('sidebar-menu-button')
    expect(buttons[0]).toHaveAttribute('data-active', 'false')
    expect(buttons[1]).toHaveAttribute('data-active', 'true')
  })

  it('marks timer as active when on root path', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/')
    render(<NavMain items={mockItems} />)
    
    const buttons = screen.getAllByTestId('sidebar-menu-button')
    expect(buttons[0]).toHaveAttribute('data-active', 'true')
    expect(buttons[1]).toHaveAttribute('data-active', 'false')
  })

  it('creates correct links', () => {
    ;(usePathname as any).mockReturnValue('/projects')
    render(<NavMain items={mockItems} />)
    
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/timer')
    expect(links[1]).toHaveAttribute('href', '/projects')
  })
})