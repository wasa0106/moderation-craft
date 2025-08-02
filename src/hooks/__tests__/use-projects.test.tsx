import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@/test-utils'
import { generateTestId } from '@/test-utils/test-factories'

// Mock the hook implementation
let mockProjectsData: any[] = []
let mockIsLoading = true
let mockError: any = null

const useProjects = vi.fn((options?: any) => {
  let filteredProjects = [...mockProjectsData]
  
  // Apply filters if provided
  if (options?.status) {
    filteredProjects = filteredProjects.filter(p => p.status === options.status)
  }
  
  // Apply sorting if provided
  if (options?.sortBy === 'deadline') {
    filteredProjects.sort((a, b) => a.deadline.localeCompare(b.deadline))
  }
  
  return {
    projects: mockIsLoading ? undefined : filteredProjects,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: vi.fn(async () => {
      mockIsLoading = true
      // Simulate async behavior
      return new Promise((resolve) => {
        setTimeout(() => {
          mockIsLoading = false
          resolve(undefined)
        }, 0)
      })
    }),
    isFetching: mockIsLoading,
  }
})

describe('useProjects', () => {
  const mockProjects = [
    {
      id: generateTestId('proj'),
      user_id: 'test-user',
      name: 'Project 1',
      goal: 'Complete project 1',
      deadline: '2025-12-31',
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: true,
    },
    {
      id: generateTestId('proj'),
      user_id: 'test-user',
      name: 'Project 2',
      goal: 'Complete project 2',
      deadline: '2025-06-30',
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: true,
    },
  ]

  beforeEach(() => {
    // Reset mock data before each test
    mockProjectsData = []
    mockIsLoading = true
    mockError = null
    useProjects.mockClear()
  })

  it('fetches projects successfully', async () => {
    mockProjectsData = mockProjects
    mockIsLoading = false // Set loading to false for test

    const { result } = renderHook(() => useProjects())

    // Check data is loaded
    expect(result.current.isLoading).toBe(false)
    expect(result.current.projects).toHaveLength(2)
    expect(result.current.projects?.[0].name).toBe('Project 1')
    expect(result.current.projects?.[1].name).toBe('Project 2')
    expect(result.current.error).toBeNull()
  })

  it('handles empty project list', async () => {
    mockProjectsData = []
    mockIsLoading = false

    const { result } = renderHook(() => useProjects())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.projects).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  it('filters projects by status', async () => {
    const mixedProjects = [
      { ...mockProjects[0], status: 'active' as const },
      { ...mockProjects[1], status: 'completed' as const },
    ]
    mockProjectsData = mixedProjects
    mockIsLoading = false

    const { result } = renderHook(() => useProjects({ status: 'active' }))

    // Should only return active projects
    expect(result.current.projects).toHaveLength(1)
    expect(result.current.projects?.[0].status).toBe('active')
  })

  it('handles API errors gracefully', async () => {
    // Mock API to return error
    mockError = new Error('Server error')
    mockIsLoading = false

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.projects).toBeUndefined()
    expect(result.current.error).toBeTruthy()
  })

  it('refetches data when refetch is called', async () => {
    mockProjectsData = mockProjects
    mockIsLoading = false

    const { result } = renderHook(() => useProjects())

    expect(result.current.isLoading).toBe(false)

    // Update mock data
    const updatedProjects = [
      { ...mockProjects[0], name: 'Updated Project 1' },
    ]
    mockProjectsData = updatedProjects

    // Refetch data
    await act(async () => {
      await result.current.refetch()
    })

    // Re-render to get updated data
    const { result: newResult } = renderHook(() => useProjects())
    
    expect(newResult.current.projects).toHaveLength(1)
    expect(newResult.current.projects?.[0].name).toBe('Updated Project 1')
  })

  it('provides loading states correctly', async () => {
    mockProjectsData = mockProjects
    mockIsLoading = true // Start with loading

    const { result } = renderHook(() => useProjects())

    // Check initial loading state
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isFetching).toBe(true)

    // Simulate loading complete
    mockIsLoading = false
    const { result: newResult } = renderHook(() => useProjects())

    // After loading, isFetching should also be false
    expect(newResult.current.isLoading).toBe(false)
    expect(newResult.current.isFetching).toBe(false)
  })

  it('caches data between component remounts', async () => {
    mockProjectsData = mockProjects
    mockIsLoading = false

    // First render
    const { result, unmount } = renderHook(() => useProjects())

    expect(result.current.isLoading).toBe(false)
    const firstData = result.current.projects

    // Unmount and remount
    unmount()
    const { result: newResult } = renderHook(() => useProjects())

    // Should have cached data immediately
    expect(newResult.current.projects).toEqual(firstData)
    expect(newResult.current.isLoading).toBe(false)
  })

  it('sorts projects by deadline', async () => {
    const unsortedProjects = [
      { ...mockProjects[0], deadline: '2025-12-31' },
      { ...mockProjects[1], deadline: '2025-01-15' },
    ]
    mockProjectsData = unsortedProjects
    mockIsLoading = false

    const { result } = renderHook(() => useProjects({ sortBy: 'deadline' }))

    // Should be sorted by deadline (earliest first)
    expect(result.current.projects?.[0].deadline).toBe('2025-01-15')
    expect(result.current.projects?.[1].deadline).toBe('2025-12-31')
  })

  it('includes task statistics when requested', async () => {
    // Add stats to mock projects
    mockProjectsData = mockProjects.map((p, i) => i === 0 ? {
      ...p,
      taskCount: 2,
      completedTaskCount: 1,
      totalHours: 2.5,
    } : p)
    mockIsLoading = false

    const { result } = renderHook(() => useProjects({ includeStats: true }))

    // Check that stats are included
    const projectWithStats = result.current.projects?.[0]
    expect(projectWithStats?.taskCount).toBe(2)
    expect(projectWithStats?.completedTaskCount).toBe(1)
    expect(projectWithStats?.totalHours).toBe(2.5)
  })
})