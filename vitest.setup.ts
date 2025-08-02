import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import React from 'react'

// @ts-expect-error - global assignment
global.vi = vi

// Make React available globally for tests
global.React = React

// Mock crypto.randomUUID for Node.js environments
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    },
  } as Crypto
}

// Mock IndexedDB
import 'fake-indexeddb/auto'

// Set up global test environment
global.process = {
  ...global.process,
  env: {
    ...global.process?.env,
    NODE_ENV: 'test',
    NEXT_PUBLIC_API_URL: '/api',
    SYNC_API_KEY: 'test-api-key',
  },
}

// Mock modules that use @ alias
// NOTE: Individual tests may override this mock

// Setup @testing-library/react
import '@testing-library/jest-dom'

// Mock MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock document.body.insertAdjacentElement if not available
if (typeof document !== 'undefined' && !document.body.insertAdjacentElement) {
  document.body.insertAdjacentElement = vi.fn()
}

// MSW Setup - temporarily disabled due to environment conflict
// We'll use direct fetch mocking for now
// import { beforeAll as vitestBeforeAll } from 'vitest'

// Mock fetch globally for tests
global.fetch = vi.fn()

// Reset handlers and cleanup after each test
afterEach(() => {
  // Cleanup React Testing Library
  cleanup()
  
  // Clear all mocks
  vi.clearAllMocks()
  
  // Clear all timers if fake timers were used
  if (vi.isFakeTimers()) {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
  
  // Reset fetch mock
  ;(global.fetch as any).mockReset()
})