import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test-utils'
import { ProjectCard } from '@/components/project/project-card'
import { mockFetch, setupDefaultMocks } from '@/test-utils/fetch-mock'
import { generateTestId } from '@/test-utils/test-factories'

// Mock the router
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('ProjectCard', () => {
  const mockProject = {
    id: generateTestId('proj'),
    user_id: 'test-user',
    name: 'Test Project',
    goal: 'Complete the test project successfully',
    deadline: '2025-12-31',
    status: 'active' as const,
    color: 'hsl(217, 91%, 60%)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    is_synced: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()

    // Mock API response for tasks
    mockFetch(`/api/small-tasks?project_id=${mockProject.id}`, {
      success: true,
      tasks: [
        {
          id: generateTestId('task'),
          user_id: 'test-user',
          project_id: mockProject.id,
          name: 'Test Task 1',
          estimated_minutes: 60,
          status: 'completed',
          is_emergency: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          is_synced: true,
        },
        {
          id: generateTestId('task'),
          user_id: 'test-user',
          project_id: mockProject.id,
          name: 'Test Task 2',
          estimated_minutes: 90,
          status: 'pending',
          is_emergency: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          is_synced: true,
        },
      ],
      count: 2,
    })
  })

  it('renders project information correctly', async () => {
    render(<ProjectCard project={mockProject} />)

    // Check project name
    expect(screen.getByText('Test Project')).toBeInTheDocument()

    // Check project goal
    expect(screen.getByText('Complete the test project successfully')).toBeInTheDocument()

    // Check deadline
    expect(screen.getByText('2025-12-31')).toBeInTheDocument()

    // Wait for tasks to load and check progress
    await waitFor(() => {
      expect(screen.getByText('進捗: 50%')).toBeInTheDocument()
    })
  })

  it('displays correct task statistics', async () => {
    render(<ProjectCard project={mockProject} />)

    await waitFor(() => {
      // Check task count
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('タスク')).toBeInTheDocument()

      // Check completed tasks
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('完了')).toBeInTheDocument()

      // Check total hours
      expect(screen.getByText('2.5')).toBeInTheDocument()
      expect(screen.getByText('時間')).toBeInTheDocument()
    })
  })

  it('navigates to project detail on click', async () => {
    render(<ProjectCard project={mockProject} />)

    const card = screen.getByRole('article')
    card.click()

    expect(mockPush).toHaveBeenCalledWith(`/projects/${mockProject.id}`)
  })

  it('applies project color as background', () => {
    render(<ProjectCard project={mockProject} />)

    const card = screen.getByRole('article')
    // The component adjusts the color to 18% saturation and 82% lightness
    expect(card).toHaveStyle({
      backgroundColor: 'hsl(217, 18%, 82%)',
    })
  })

  it('shows loading state initially', () => {
    render(<ProjectCard project={mockProject} />)

    // Check for skeleton loaders
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('handles projects without tasks', async () => {
    const projectWithoutTasks = { ...mockProject, id: 'project-no-tasks' }
    seedMockDatabase({
      projects: [projectWithoutTasks],
      smallTasks: [],
    })

    render(<ProjectCard project={projectWithoutTasks} />)

    await waitFor(() => {
      // Should show 0 tasks
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('タスク')).toBeInTheDocument()

      // Should show 0% progress
      expect(screen.getByText('進捗: 0%')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    // Mock console.error to prevent error logging in tests
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Create a project with invalid ID that will cause error
    const invalidProject = { ...mockProject, id: 'invalid' }

    render(<ProjectCard project={invalidProject} />)

    await waitFor(() => {
      // Should still show project info
      expect(screen.getByText('Test Project')).toBeInTheDocument()

      // Should show 0 for stats when error occurs
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBeGreaterThan(0)
    })

    consoleError.mockRestore()
  })

  it('displays correct status for different project states', () => {
    const completedProject = { ...mockProject, status: 'completed' as const }
    const { rerender } = render(<ProjectCard project={completedProject} />)

    // For completed projects, card should have different styling
    const card = screen.getByRole('article')
    expect(card).toHaveClass('opacity-80')

    // Test with paused project
    const pausedProject = { ...mockProject, status: 'paused' as const }
    rerender(<ProjectCard project={pausedProject} />)

    // Paused projects might have different visual indicators
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('calculates progress correctly with various task states', async () => {
    seedMockDatabase({
      projects: [mockProject],
      smallTasks: [
        {
          id: '1',
          project_id: mockProject.id,
          status: 'completed',
          estimated_minutes: 60,
        },
        {
          id: '2',
          project_id: mockProject.id,
          status: 'completed',
          estimated_minutes: 30,
        },
        {
          id: '3',
          project_id: mockProject.id,
          status: 'pending',
          estimated_minutes: 60,
        },
        {
          id: '4',
          project_id: mockProject.id,
          status: 'cancelled',
          estimated_minutes: 30,
        },
      ],
    })

    render(<ProjectCard project={mockProject} />)

    await waitFor(() => {
      // Progress should be (90 completed) / (150 total non-cancelled) = 60%
      expect(screen.getByText('進捗: 60%')).toBeInTheDocument()
    })
  })
})
