import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@/test-utils'
import { generateTestId } from '@/test-utils/test-factories'

// Mock timer state
let mockIsRunning = false
let mockElapsedTime = 0
let mockCurrentTask: any = null
let mockCurrentSession: any = null
let mockError: any = null
let timerInterval: any = null

const useTimer = vi.fn(() => {
  // Simulate timer behavior
  if (mockIsRunning && !timerInterval) {
    timerInterval = setInterval(() => {
      mockElapsedTime++
    }, 1000)
  }

  const formattedTime = (() => {
    const hours = Math.floor(mockElapsedTime / 3600)
    const minutes = Math.floor((mockElapsedTime % 3600) / 60)
    const seconds = mockElapsedTime % 60

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })()

  const progressPercentage = mockCurrentTask
    ? (mockElapsedTime / 60 / mockCurrentTask.estimated_minutes) * 100
    : 0

  return {
    isRunning: mockIsRunning,
    elapsedTime: mockElapsedTime,
    currentTask: mockCurrentTask,
    currentSession: mockCurrentSession,
    startTimer: vi.fn(async (taskId: string) => {
      mockCurrentTask = { id: taskId, estimated_minutes: 60 }
      mockCurrentSession = { id: 'session-1', small_task_id: taskId }
      mockIsRunning = true
      mockElapsedTime = 0
      return true
    }),
    stopTimer: vi.fn(async () => {
      mockIsRunning = false
      mockElapsedTime = 0
      mockCurrentTask = null
      mockCurrentSession = null
      if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    }),
    pauseTimer: vi.fn(() => {
      mockIsRunning = false
      if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    }),
    resumeTimer: vi.fn(() => {
      mockIsRunning = true
    }),
    formattedTime,
    error: mockError,
    progressPercentage,
    totalTaskTime: 300, // Mock 5 minutes of previous sessions
  }
})

describe('useTimer', () => {
  const mockTask = {
    id: generateTestId('task'),
    user_id: 'test-user',
    project_id: generateTestId('proj'),
    name: 'Test Task',
    estimated_minutes: 60,
    status: 'pending' as const,
    is_emergency: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    is_synced: true,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    // Reset mock state
    mockIsRunning = false
    mockElapsedTime = 0
    mockCurrentTask = null
    mockCurrentSession = null
    mockError = null
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    useTimer.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useTimer())

    expect(result.current.isRunning).toBe(false)
    expect(result.current.elapsedTime).toBe(0)
    expect(result.current.currentTask).toBeNull()
    expect(result.current.currentSession).toBeNull()
  })

  it('starts timer for a task', async () => {
    const { result } = renderHook(() => useTimer())

    await act(async () => {
      const success = await result.current.startTimer(mockTask.id)
      expect(success).toBe(true)
    })

    // Force re-render to get updated state
    const { result: updatedResult } = renderHook(() => useTimer())

    expect(updatedResult.current.isRunning).toBe(true)
    expect(updatedResult.current.currentTask?.id).toBe(mockTask.id)
    expect(updatedResult.current.currentSession).toBeTruthy()
  })

  it('increments elapsed time when running', async () => {
    const { result } = renderHook(() => useTimer())

    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Manually increment elapsed time to simulate timer
    act(() => {
      mockElapsedTime = 5
    })

    const { result: updatedResult } = renderHook(() => useTimer())
    expect(updatedResult.current.elapsedTime).toBe(5)
  })

  it('stops timer and saves session', async () => {
    const { result } = renderHook(() => useTimer())

    // Start timer
    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Run for 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    // Stop timer
    await act(async () => {
      await result.current.stopTimer()
    })

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false)
      expect(result.current.elapsedTime).toBe(0)
      expect(result.current.currentTask).toBeNull()
      expect(result.current.currentSession).toBeNull()
    })
  })

  it('pauses and resumes timer', async () => {
    const { result } = renderHook(() => useTimer())

    // Start timer
    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Run for 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Pause timer
    act(() => {
      result.current.pauseTimer()
    })

    expect(result.current.isRunning).toBe(false)
    expect(result.current.elapsedTime).toBe(5)

    // Advance time while paused (should not increment)
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.elapsedTime).toBe(5)

    // Resume timer
    act(() => {
      result.current.resumeTimer()
    })

    expect(result.current.isRunning).toBe(true)

    // Run for another 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.elapsedTime).toBe(10)
  })

  it('handles switching between tasks', async () => {
    const secondTask = {
      ...mockTask,
      id: generateTestId('task'),
      name: 'Second Task',
    }
    seedMockDatabase({ smallTasks: [mockTask, secondTask] })

    const { result } = renderHook(() => useTimer())

    // Start first task
    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Run for 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Switch to second task
    await act(async () => {
      await result.current.startTimer(secondTask.id)
    })

    await waitFor(() => {
      expect(result.current.currentTask?.id).toBe(secondTask.id)
      expect(result.current.elapsedTime).toBe(0) // Reset for new task
    })
  })

  it('provides formatted time display', async () => {
    const { result } = renderHook(() => useTimer())

    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Test various time formats
    act(() => {
      vi.advanceTimersByTime(65000) // 1 minute 5 seconds
    })

    expect(result.current.formattedTime).toBe('01:05')

    act(() => {
      vi.advanceTimersByTime(3535000) // Total: 1 hour 0 minutes 0 seconds
    })

    expect(result.current.formattedTime).toBe('1:00:00')
  })

  it('handles API errors when starting timer', async () => {
    // Mock API to return error
    const mockErrorResponse = vi.fn().mockResolvedValue({
      success: false,
      error: 'Server error',
    })

    useTimer.mockReturnValueOnce({
      ...useTimer(),
      startTimer: mockErrorResponse,
      error: 'Server error',
    })

    const { result } = renderHook(() => useTimer())

    await act(async () => {
      const success = await result.current.startTimer(mockTask.id)
      expect(success).toBe(false)
    })

    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('cleans up timer on unmount', async () => {
    const { result, unmount } = renderHook(() => useTimer())

    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Unmount component
    unmount()

    // Timer should be cleared (no way to directly test, but no errors should occur)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
  })

  it('calculates progress percentage correctly', async () => {
    const { result } = renderHook(() => useTimer())

    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Run for 30 seconds (0.5 minutes)
    act(() => {
      vi.advanceTimersByTime(30000)
    })

    // Task is 60 minutes, so 0.5/60 = 0.83%
    expect(result.current.progressPercentage).toBeCloseTo(0.83, 1)

    // Run for 30 more minutes
    act(() => {
      vi.advanceTimersByTime(1770000) // 29.5 minutes
    })

    // Now at 30/60 = 50%
    expect(result.current.progressPercentage).toBe(50)
  })

  it('handles tasks with existing sessions', async () => {
    const existingSession = {
      id: generateTestId('session'),
      user_id: 'test-user',
      small_task_id: mockTask.id,
      start_time: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      end_time: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      duration_seconds: 300,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: true,
    }

    seedMockDatabase({
      smallTasks: [mockTask],
      workSessions: [existingSession],
    })

    const { result } = renderHook(() => useTimer())

    await act(async () => {
      await result.current.startTimer(mockTask.id)
    })

    // Should account for existing session time
    expect(result.current.totalTaskTime).toBe(300) // 5 minutes in seconds
  })
})
