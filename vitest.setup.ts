import { vi } from 'vitest'

// @ts-expect-error - global assignment
global.vi = vi

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