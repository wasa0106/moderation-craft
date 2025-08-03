import React from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { vi, expect } from 'vitest'

/**
 * Custom render function that includes all necessary providers
 */

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial route for testing
   */
  initialRoute?: string
  /**
   * Custom QueryClient configuration
   */
  queryClient?: QueryClient
}

/**
 * Create a test QueryClient with optimized settings for tests
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries in tests
        retry: false,
        // Use shorter garbage collection time for tests
        gcTime: 0,
        // Don't refetch on window focus in tests
        refetchOnWindowFocus: false,
        // Use shorter stale time for tests
        staleTime: 0,
      },
      mutations: {
        // Disable retries in tests
        retry: false,
      },
    },
  })
}

/**
 * All the providers for testing
 */
function AllTheProviders({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors closeButton />
    </QueryClientProvider>
  )
}

/**
 * Custom render function for testing
 * Wraps components with all necessary providers
 */
export function render(ui: React.ReactElement, options?: CustomRenderOptions) {
  const { initialRoute, queryClient = createTestQueryClient(), ...renderOptions } = options || {}

  // Set initial route if provided
  if (initialRoute && typeof window !== 'undefined') {
    window.history.pushState({}, '', initialRoute)
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
  }

  return {
    ...rtlRender(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

/**
 * Render hook with providers
 */
export function renderHook<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: CustomRenderOptions
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options || {}

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
  }

  // Import renderHook from testing library react hooks
  const { renderHook: rtlRenderHook } = require('@testing-library/react')
  return {
    ...rtlRenderHook(hook, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

/**
 * Create a user event instance with proper setup
 */
export function createUser() {
  return userEvent.setup()
}

/**
 * Wait for async operations with a custom timeout
 */
export async function waitFor(callback: () => void | Promise<void>, options = { timeout: 5000 }) {
  const { waitFor: rtlWaitFor } = require('@testing-library/react')
  return rtlWaitFor(callback, options)
}

/**
 * Mock next/navigation
 */
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}

/**
 * Mock next/navigation hooks
 */
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

/**
 * Reset all router mocks
 */
export function resetRouterMocks() {
  mockRouter.push.mockClear()
  mockRouter.replace.mockClear()
  mockRouter.refresh.mockClear()
  mockRouter.back.mockClear()
  mockRouter.forward.mockClear()
  mockRouter.prefetch.mockClear()
}

/**
 * Wait for loading states to resolve
 */
export async function waitForLoadingToFinish(
  screen: typeof import('@testing-library/react').screen,
  options = { timeout: 4000 }
) {
  await waitFor(() => {
    const loaders = [
      ...screen.queryAllByTestId(/loading/i),
      ...screen.queryAllByText(/loading/i),
      ...screen.queryAllByRole('progressbar'),
    ]
    expect(loaders).toHaveLength(0)
  }, options)
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'

// Export custom utilities
export { default as userEvent } from '@testing-library/user-event'
