import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGoal, createAISuggestionResponse } from '@/test-utils/test-factories'
import { mockFetch, setupDefaultMocks } from '@/test-utils/fetch-mock'

/**
 * Verification test to ensure test environment is set up correctly
 */
describe('Test Environment Setup Verification', () => {
  beforeEach(() => {
    setupDefaultMocks()
  })
  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test')
    expect(process.env.NEXT_PUBLIC_API_URL).toBe('/api')
    expect(process.env.SYNC_API_KEY).toBe('test-api-key')
  })

  it('should have fetch mocking working', async () => {
    // Test API health check endpoint (mocked by setupDefaultMocks)
    const response = await fetch('/api/health')
    const data = await response.json()

    expect(response.ok).toBe(true)
    expect(data).toHaveProperty('status', 'ok')
    expect(data).toHaveProperty('timestamp')
  })

  it('should mock API requests correctly', async () => {
    // Test reverse WBS suggestion endpoint
    const goal = createGoal()
    const mockResponse = createAISuggestionResponse()

    mockFetch('/api/reverse-wbs/suggest', mockResponse)

    const response = await fetch('/api/reverse-wbs/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: goal.text }),
    })

    const data = await response.json()

    expect(response.ok).toBe(true)
    expect(data.success).toBe(true)
    expect(data.tasks).toBeDefined()
    expect(data.tasks.length).toBeGreaterThan(0)
    expect(data.tasks[0]).toHaveProperty('name')
    expect(data.tasks[0]).toHaveProperty('estimatedHours')
  })

  it('should handle unauthorized requests', async () => {
    // Test sync endpoint without API key
    mockFetch(
      '/api/sync',
      {
        success: false,
        error: 'API key is required. Please provide x-api-key header.',
      },
      { status: 401 }
    )

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'project', payload: {} }),
    })

    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error).toContain('API key is required')
  })

  it('should generate test data using factories', () => {
    const goal = createGoal({ text: 'Custom goal' })
    expect(goal.text).toBe('Custom goal')
    expect(goal.category).toBe('development')
    expect(goal.deadline).toBe('2025-12-31')

    const aiResponse = createAISuggestionResponse()
    expect(aiResponse.success).toBe(true)
    expect(aiResponse.tasks).toHaveLength(2)
    expect(aiResponse.tasks[0].name).toBe('要件定義')
  })

  it('should support async operations with fake timers', () => {
    vi.useFakeTimers()

    let value = 'initial'

    // Simulate async operation
    setTimeout(() => {
      value = 'updated'
    }, 100)

    // Advance timers
    vi.advanceTimersByTime(100)

    expect(value).toBe('updated')

    vi.useRealTimers()
  })

  it('should have vitest globals available', () => {
    expect(vi).toBeDefined()
    expect(describe).toBeDefined()
    expect(it).toBeDefined()
    expect(expect).toBeDefined()
  })
})
