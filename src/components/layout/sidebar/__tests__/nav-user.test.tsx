import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { NavUser } from '../nav-user'

vi.mock('@/components/ui/sidebar', () => ({
  SidebarMenu: ({ children }: any) => <div data-testid="sidebar-menu">{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div data-testid="sidebar-menu-item">{children}</div>,
  SidebarMenuButton: ({ children, asChild, size }: any) => {
    const Component = asChild ? 'div' : 'button'
    return (
      <Component data-testid="sidebar-menu-button" data-size={size}>
        {children}
      </Component>
    )
  },
  useSidebar: () => ({ isMobile: false }),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => {
    const Component = asChild ? 'div' : 'button'
    return <Component data-testid="dropdown-trigger">{children}</Component>
  },
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div data-testid="dropdown-label">{children}</div>,
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
  DropdownMenuItem: ({ children }: any) => <div data-testid="dropdown-item">{children}</div>,
  DropdownMenuGroup: ({ children }: any) => <div data-testid="dropdown-group">{children}</div>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div data-testid="avatar">{children}</div>,
  AvatarImage: ({ src, alt }: any) => <img data-testid="avatar-image" src={src} alt={alt} />,
  AvatarFallback: ({ children }: any) => <div data-testid="avatar-fallback">{children}</div>,
}))

vi.mock('lucide-react', () => ({
  ChevronsUpDown: () => <span>ChevronsUpDown</span>,
  LogOut: () => <span>LogOut</span>,
  Settings: () => <span>Settings</span>,
  User: () => <span>User</span>,
}))

const mockUser = {
  name: 'テストユーザー',
  email: 'test@example.com',
  avatar: '/test-avatar.png',
}

describe('NavUser', () => {
  it('renders user name and email', () => {
    render(<NavUser user={mockUser} />)

    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('renders user avatar', () => {
    render(<NavUser user={mockUser} />)

    const avatar = screen.getByTestId('avatar-image')
    expect(avatar).toHaveAttribute('src', '/test-avatar.png')
    expect(avatar).toHaveAttribute('alt', 'テストユーザー')
  })

  it('renders avatar fallback when no avatar provided', () => {
    const userWithoutAvatar = { ...mockUser, avatar: undefined }
    render(<NavUser user={userWithoutAvatar} />)

    expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument()
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('renders dropdown menu items', () => {
    render(<NavUser user={mockUser} />)

    expect(screen.getByText('プロフィール')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })

  it('shows ChevronsUpDown icon', () => {
    render(<NavUser user={mockUser} />)

    expect(screen.getByText('ChevronsUpDown')).toBeInTheDocument()
  })
})
