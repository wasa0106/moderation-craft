/**
 * Mock data utilities for MSW handlers
 * These utilities are separated from test-utils to avoid importing test dependencies in development builds
 */

/**
 * Generate a unique ID for mock entities
 */
export function generateMockId(prefix: string = 'mock'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a mock goal
 */
export function createMockGoal(overrides: Partial<{ text: string; category: string; deadline: string }> = {}) {
  return {
    text: 'Webアプリケーションを3ヶ月で開発する',
    category: 'development',
    deadline: '2025-12-31',
    ...overrides,
  }
}

/**
 * WBS Task interface for mocks
 */
export interface MockWBSTask {
  id: string
  name: string
  level: number
  estimatedHours: number
  parentId?: string
  children?: MockWBSTask[]
  dependencies?: string[]
}

/**
 * Create a mock WBS task
 */
export function createMockWBSTask(overrides: Partial<MockWBSTask> = {}): MockWBSTask {
  return {
    id: generateMockId('wbs'),
    name: 'タスク名',
    level: 1,
    estimatedHours: 8,
    ...overrides,
  }
}