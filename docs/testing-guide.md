# ModerationCraft Testing Guide

## Overview

This guide explains how to write and run tests for the ModerationCraft project. The testing setup uses Vitest with React Testing Library and a custom fetch mocking system.

## Test Setup

### Configuration Files

- `vitest.config.ts` - Main Vitest configuration
- `vitest.setup.ts` - Global test setup (mocks, environment)
- `src/test-utils/` - Testing utilities and helpers

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/components/timer/__tests__/task-card.test.tsx
```

## Writing Tests

### Basic Component Test

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, createUser } from '@/test-utils'
import { MyComponent } from '@/components/my-component'

describe('MyComponent', () => {
  const user = createUser()

  it('renders correctly', () => {
    render(<MyComponent title="Test" />)
    
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const handleClick = vi.fn()
    render(<MyComponent onClick={handleClick} />)
    
    await user.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalled()
  })
})
```

### Testing with API Calls

Since MSW is temporarily disabled, use the fetch mock utilities:

```tsx
import { mockFetch, setupDefaultMocks } from '@/test-utils/fetch-mock'

describe('API Integration', () => {
  beforeEach(() => {
    setupDefaultMocks()
  })

  it('fetches data successfully', async () => {
    const mockData = { id: '1', name: 'Test' }
    mockFetch('/api/items/1', mockData)
    
    const response = await fetch('/api/items/1')
    const data = await response.json()
    
    expect(data).toEqual(mockData)
  })

  it('handles errors', async () => {
    mockFetch('/api/items/1', { error: 'Not found' }, { status: 404 })
    
    const response = await fetch('/api/items/1')
    
    expect(response.status).toBe(404)
  })
})
```

### Testing Hooks

```tsx
import { renderHook, waitFor } from '@/test-utils'
import { useMyHook } from '@/hooks/use-my-hook'

describe('useMyHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useMyHook())
    
    expect(result.current.value).toBe(0)
  })

  it('updates state', async () => {
    const { result } = renderHook(() => useMyHook())
    
    act(() => {
      result.current.increment()
    })
    
    await waitFor(() => {
      expect(result.current.value).toBe(1)
    })
  })
})
```

### Testing with Providers

The custom `render` function automatically wraps components with necessary providers:

```tsx
// This automatically includes QueryClient, Toaster, etc.
render(<MyComponent />)

// You can provide custom QueryClient if needed
const queryClient = createTestQueryClient()
render(<MyComponent />, { queryClient })
```

### Mocking Next.js Navigation

Navigation hooks are automatically mocked:

```tsx
import { mockRouter, resetRouterMocks } from '@/test-utils'

it('navigates to project page', async () => {
  render(<ProjectCard project={mockProject} />)
  
  await user.click(screen.getByRole('article'))
  
  expect(mockRouter.push).toHaveBeenCalledWith('/projects/123')
})

afterEach(() => {
  resetRouterMocks()
})
```

## Best Practices

### 1. Use Descriptive Test Names

```tsx
// ❌ Bad
it('works', () => {})

// ✅ Good
it('displays error message when form submission fails', () => {})
```

### 2. Follow AAA Pattern

```tsx
it('updates task status when complete button is clicked', async () => {
  // Arrange
  const task = createTask({ status: 'pending' })
  render(<TaskCard task={task} />)
  
  // Act
  await user.click(screen.getByText('完了'))
  
  // Assert
  expect(screen.getByText('完了しました')).toBeInTheDocument()
})
```

### 3. Test User Behavior, Not Implementation

```tsx
// ❌ Bad - Testing implementation details
expect(component.state.isOpen).toBe(true)

// ✅ Good - Testing user-visible behavior
expect(screen.getByRole('dialog')).toBeInTheDocument()
```

### 4. Use Test Factories

```tsx
import { createProject, createTask } from '@/test-utils/test-factories'

const project = createProject({ name: 'Test Project' })
const task = createTask({ project_id: project.id })
```

### 5. Clean Up After Tests

```tsx
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup() // Automatically done by test-utils
})
```

## Common Testing Patterns

### Loading States

```tsx
it('shows loading state while fetching', async () => {
  render(<ProjectList />)
  
  expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  
  await waitForLoadingToFinish(screen)
  
  expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
})
```

### Error States

```tsx
it('displays error message on API failure', async () => {
  mockFetch('/api/projects', { error: 'Server error' }, { status: 500 })
  
  render(<ProjectList />)
  
  await waitFor(() => {
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })
})
```

### Form Testing

```tsx
it('validates required fields', async () => {
  render(<ProjectForm />)
  
  // Submit without filling fields
  await user.click(screen.getByText('保存'))
  
  expect(screen.getByText('プロジェクト名を入力してください')).toBeInTheDocument()
})
```

## Debugging Tests

### View Testing Library Queries

```tsx
// Print current DOM
screen.debug()

// Print specific element
screen.debug(screen.getByRole('button'))
```

### Use Testing Playground

```tsx
// Log testing playground URL
screen.logTestingPlaygroundURL()
```

### Check What's Available

```tsx
// See all available queries
const { container } = render(<MyComponent />)
console.log(container.innerHTML)
```

## Known Issues

1. **MSW Setup**: Currently using simple fetch mocking instead of MSW due to environment conflicts
2. **Storybook Tests**: The pattern `src/**/*.mdx` warning can be ignored
3. **Component Imports**: Some tests may need path adjustments based on actual component locations

## Future Improvements

1. Re-enable MSW for more sophisticated API mocking
2. Add E2E tests with Playwright
3. Increase test coverage to meet thresholds (80% lines, branches, functions)
4. Add visual regression tests
5. Set up continuous integration testing