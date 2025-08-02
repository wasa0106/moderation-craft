/**
 * Test data factories for consistent test data generation
 * This file provides the foundation for creating mock data in tests
 */

import { vi } from 'vitest'

/**
 * Base factory function type
 */
type Factory<T> = (overrides?: Partial<T>) => T

/**
 * Generate a unique ID for test entities
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate a random date within a range
 */
export function generateRandomDate(start: Date = new Date(2024, 0, 1), end: Date = new Date(2025, 11, 31)): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

/**
 * Reverse WBS related factories
 */

// Goal factory for reverse WBS
export const createGoal: Factory<{ text: string; category: string; deadline: string }> = (overrides = {}) => ({
  text: 'Webアプリケーションを3ヶ月で開発する',
  category: 'development',
  deadline: '2025-12-31',
  ...overrides,
})

// WBS Task factory
export interface WBSTask {
  id: string
  name: string
  level: number
  estimatedHours: number
  parentId?: string
  children?: WBSTask[]
  dependencies?: string[]
}

export const createWBSTask: Factory<WBSTask> = (overrides = {}) => ({
  id: generateTestId('task'),
  name: 'サンプルタスク',
  level: 1,
  estimatedHours: 8,
  children: [],
  dependencies: [],
  ...overrides,
})

// Task hierarchy factory
export function createTaskHierarchy(depth: number = 2, breadth: number = 3): WBSTask {
  const rootTask = createWBSTask({
    name: 'ルートタスク',
    level: 1,
    children: [],
  })

  function addChildren(parent: WBSTask, currentDepth: number) {
    if (currentDepth >= depth) return

    for (let i = 0; i < breadth; i++) {
      const child = createWBSTask({
        name: `タスク L${currentDepth + 1}-${i + 1}`,
        level: currentDepth + 1,
        parentId: parent.id,
        estimatedHours: Math.floor(Math.random() * 8) + 1,
        children: [],
      })

      parent.children!.push(child)
      addChildren(child, currentDepth + 1)
    }
  }

  addChildren(rootTask, 1)
  return rootTask
}

// Dependency relationship factory
export interface DependencyRelation {
  fromTaskId: string
  toTaskId: string
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish'
}

export const createDependency: Factory<DependencyRelation> = (overrides = {}) => ({
  fromTaskId: generateTestId('task'),
  toTaskId: generateTestId('task'),
  type: 'finish-to-start',
  ...overrides,
})

/**
 * API response factories
 */

// AI suggestion response factory
export const createAISuggestionResponse = (overrides: any = {}) => ({
  success: true,
  tasks: [
    createWBSTask({
      name: '要件定義',
      level: 1,
      estimatedHours: 16,
      children: [
        createWBSTask({ name: 'ユーザーストーリー作成', level: 2, estimatedHours: 8 }),
        createWBSTask({ name: '機能要件定義', level: 2, estimatedHours: 8 }),
      ],
    }),
    createWBSTask({
      name: '設計',
      level: 1,
      estimatedHours: 24,
      children: [
        createWBSTask({ name: 'アーキテクチャ設計', level: 2, estimatedHours: 12 }),
        createWBSTask({ name: 'データベース設計', level: 2, estimatedHours: 12 }),
      ],
    }),
  ],
  ...overrides,
})

// Validation response factory
export const createValidationResponse = (valid: boolean = true, errors: string[] = []) => ({
  success: true,
  valid,
  errors,
})

// Conversion response factory
export const createConversionResponse = (overrides: any = {}) => ({
  success: true,
  projectId: generateTestId('proj'),
  message: 'WBS successfully converted to project',
  ...overrides,
})

/**
 * Error response factory
 */
export const createErrorResponse = (message: string, status: number = 400) => ({
  success: false,
  error: message,
  status,
})

/**
 * Test helpers
 */

// Create a mock API client
export function createMockApiClient() {
  return {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}

// Create mock timers for testing time-dependent features
export function useFakeTimers() {
  vi.useFakeTimers()
  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAll: () => vi.runAllTimers(),
    restore: () => vi.useRealTimers(),
  }
}