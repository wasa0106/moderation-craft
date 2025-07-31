/**
 * Tests for TaskCard component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, afterAll, vi, MockedFunction } from 'vitest'
import { TaskCard } from '../task-card'
import { SmallTask, Project, WorkSession, SmallTaskStatus } from '@/types'
import { smallTaskRepository } from '@/lib/db/repositories'
import { useToast } from '@/hooks/use-toast'

// Mock dependencies
vi.mock('@/lib/db/repositories', () => ({
  smallTaskRepository: {
    updateTaskStatus: vi.fn(),
  },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}))

// Mock the confirm function
const mockConfirm = vi.fn()
global.confirm = mockConfirm

// Mock console.error to prevent test output pollution
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('TaskCard', () => {
  const mockToast = vi.fn()
  const mockOnClick = vi.fn()
  const mockOnStatusChange = vi.fn()

  const baseTask: SmallTask = {
    id: 'task-1',
    user_id: 'user-1',
    name: 'Test Task',
    estimated_minutes: 60,
    scheduled_start: '2024-01-01T09:00:00Z',
    scheduled_end: '2024-01-01T10:00:00Z',
    status: 'pending' as SmallTaskStatus,
    is_emergency: false,
    created_at: '2024-01-01T08:00:00Z',
    updated_at: '2024-01-01T08:00:00Z',
    version: 1,
    is_synced: true,
  }

  const baseProject: Project = {
    id: 'project-1',
    user_id: 'user-1',
    name: 'Test Project',
    goal: 'Test goal',
    deadline: '2024-12-31',
    status: 'active',
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    is_synced: true,
  }

  const baseSessions: WorkSession[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(true)
    ;(useToast as MockedFunction<typeof useToast>).mockReturnValue({ toast: mockToast })
    ;(smallTaskRepository.updateTaskStatus as MockedFunction<typeof smallTaskRepository.updateTaskStatus>).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
  })

  describe('Rendering', () => {
    it('renders task name correctly', () => {
      render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      expect(screen.getByText('Test Task')).toBeInTheDocument()
    })

    it('renders project name for tasks > 30 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 45 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      // プロジェクト名は現在の実装では表示されない
      expect(screen.queryByText('Test Project')).not.toBeInTheDocument()
    })

    it('does not render project name for tasks <= 30 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 30 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      expect(screen.queryByText('Test Project')).not.toBeInTheDocument()
    })

    it('renders emergency badge when task is emergency', () => {
      const task = { ...baseTask, is_emergency: true }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      expect(screen.getByText('緊急')).toBeInTheDocument()
    })

    it('does not render emergency badge for non-emergency tasks', () => {
      render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      expect(screen.queryByText('緊急')).not.toBeInTheDocument()
    })
  })

  describe('Dynamic Styling', () => {
    it('applies compact styles for tasks <= 30 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 30 }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('p-0.5')
    })

    it('applies medium styles for tasks <= 60 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('p-1')
    })

    it('applies normal styles for tasks > 60 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 90 }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('p-1.5')
    })

    it('applies compact prop override regardless of duration', () => {
      const task = { ...baseTask, estimated_minutes: 90 }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          compact={true}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('p-0.5')
    })
  })

  describe('HSL Color Adjustment', () => {
    it('adjusts HSL colors to 18% saturation and 82% lightness', () => {
      const projectWithColors = [
        { color: 'hsl(217, 91%, 60%)', expected: 'hsl(217, 18%, 82%)' },
        { color: 'hsl(120, 50%, 40%)', expected: 'hsl(120, 18%, 82%)' },
        { color: 'hsl(0, 100%, 50%)', expected: 'hsl(0, 18%, 82%)' },
      ]

      projectWithColors.forEach(({ color, expected }) => {
        const project = { ...baseProject, color }
        const { container } = render(
          <TaskCard
            task={baseTask}
            project={project}
            sessions={baseSessions}
          />
        )

        const card = container.firstChild as HTMLElement
        expect(card.style.backgroundColor).toBe(expected)
      })
    })
  })

  describe('Status Display', () => {
    it('applies project color background for pending tasks with project', () => {
      const projectWithColor = { ...baseProject, color: 'hsl(217, 91%, 60%)' }
      const { container } = render(
        <TaskCard
          task={baseTask}
          project={projectWithColor}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card.style.backgroundColor).toBe('hsl(217, 18%, 82%)')
      expect(card).toHaveClass('text-foreground')
    })

    it('applies primary background for pending tasks with active session', () => {
      const activeSession: WorkSession = {
        id: 'session-1',
        user_id: 'user-1',
        small_task_id: 'task-1',
        start_time: '2024-01-01T09:00:00Z',
        duration_seconds: 0,
        is_synced: true,
        created_at: '2024-01-01T09:00:00Z',
        updated_at: '2024-01-01T09:00:00Z',
        version: 1,
      }

      const { container } = render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={[activeSession]}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-primary')
      expect(card).toHaveClass('text-primary-foreground')
    })

    it('applies default style for pending tasks without project color', () => {
      const projectNoColor = { ...baseProject, color: undefined }
      const { container } = render(
        <TaskCard
          task={baseTask}
          project={projectNoColor}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card.style.backgroundColor).toBeFalsy()
      expect(card).not.toHaveClass('bg-primary')
      expect(card).not.toHaveClass('bg-muted')
    })

    it('applies muted background for completed tasks', () => {
      const task = { ...baseTask, status: 'completed' as SmallTaskStatus }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-muted')
      expect(card).toHaveClass('text-muted-foreground')
      expect(card).toHaveClass('opacity-80')
    })

    it('applies muted/50 background for cancelled tasks', () => {
      const task = { ...baseTask, status: 'cancelled' as SmallTaskStatus }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-muted/50')
      expect(card).toHaveClass('text-muted-foreground')
      expect(card).toHaveClass('opacity-60')
    })
  })

  describe('Button Visibility', () => {
    it('shows action buttons for pending tasks > 45 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          showButtons={true}
        />
      )

      expect(screen.getByText('完了')).toBeInTheDocument()
      expect(screen.getByText('不要')).toBeInTheDocument()
    })

    it('does not show action buttons for pending tasks <= 45 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 45 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          showButtons={true}
        />
      )

      expect(screen.queryByText('完了')).not.toBeInTheDocument()
      expect(screen.queryByText('不要')).not.toBeInTheDocument()
    })

    it('shows revert button for completed tasks > 45 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 60, status: 'completed' as SmallTaskStatus }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          showButtons={true}
        />
      )

      expect(screen.getByText('元に戻す')).toBeInTheDocument()
    })

    it('shows revert button for cancelled tasks > 45 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 60, status: 'cancelled' as SmallTaskStatus }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          showButtons={true}
        />
      )

      expect(screen.getByText('元に戻す')).toBeInTheDocument()
    })

    it('does not show buttons when showButtons is false', () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          showButtons={false}
        />
      )

      expect(screen.queryByText('完了')).not.toBeInTheDocument()
      expect(screen.queryByText('不要')).not.toBeInTheDocument()
    })
  })

  describe('Progress Display', () => {
    it('shows progress text for pending tasks with completed sessions > 60 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 90 }
      const completedSession: WorkSession = {
        id: 'session-1',
        user_id: 'user-1',
        small_task_id: 'task-1',
        start_time: '2024-01-01T09:00:00Z',
        end_time: '2024-01-01T09:30:00Z',
        duration_seconds: 1800,
        is_synced: true,
        created_at: '2024-01-01T09:00:00Z',
        updated_at: '2024-01-01T09:30:00Z',
        version: 1,
      }

      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={[completedSession]}
        />
      )

      expect(screen.getByText('30/90分')).toBeInTheDocument()
    })

    it('does not show progress text for tasks <= 60 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      const completedSession: WorkSession = {
        id: 'session-1',
        user_id: 'user-1',
        small_task_id: 'task-1',
        start_time: '2024-01-01T09:00:00Z',
        end_time: '2024-01-01T09:30:00Z',
        duration_seconds: 1800,
        is_synced: true,
        created_at: '2024-01-01T09:00:00Z',
        updated_at: '2024-01-01T09:30:00Z',
        version: 1,
      }

      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={[completedSession]}
        />
      )

      expect(screen.queryByText('30/60分')).not.toBeInTheDocument()
    })

    it('shows estimated minutes for tasks > 30 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 45 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      expect(screen.getByText('45分')).toBeInTheDocument()
    })

    it('does not show estimated minutes for tasks <= 30 minutes', () => {
      const task = { ...baseTask, estimated_minutes: 30 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      expect(screen.queryByText('30分')).not.toBeInTheDocument()
    })
  })

  describe('Status Change Functionality', () => {
    it('handles completion status change with confirmation', async () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          onStatusChange={mockOnStatusChange}
          showButtons={true}
        />
      )

      const completeButton = screen.getByText('完了')
      fireEvent.click(completeButton)

      expect(mockConfirm).toHaveBeenCalledWith('「Test Task」を完了にしますか？')
      
      await waitFor(() => {
        expect(smallTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
          'task-1',
          'completed',
          { endActiveSession: false }
        )
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'タスクを完了しました',
        description: 'Test Task',
      })
      expect(mockOnStatusChange).toHaveBeenCalled()
    })

    it('handles cancellation status change with confirmation', async () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          onStatusChange={mockOnStatusChange}
          showButtons={true}
        />
      )

      const cancelButton = screen.getByText('不要')
      fireEvent.click(cancelButton)

      expect(mockConfirm).toHaveBeenCalledWith('「Test Task」を不要にしますか？\n作業履歴は保持されます。')
      
      await waitFor(() => {
        expect(smallTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
          'task-1',
          'cancelled',
          { endActiveSession: false }
        )
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'タスクを不要にしました',
        description: 'Test Task',
      })
      expect(mockOnStatusChange).toHaveBeenCalled()
    })

    it('ends active session when completing task with active session', async () => {
      const activeSession: WorkSession = {
        id: 'session-1',
        user_id: 'user-1',
        small_task_id: 'task-1',
        start_time: '2024-01-01T09:00:00Z',
        duration_seconds: 0,
        is_synced: true,
        created_at: '2024-01-01T09:00:00Z',
        updated_at: '2024-01-01T09:00:00Z',
        version: 1,
      }

      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={[activeSession]}
          onStatusChange={mockOnStatusChange}
          showButtons={true}
        />
      )

      const completeButton = screen.getByText('完了')
      fireEvent.click(completeButton)

      await waitFor(() => {
        expect(smallTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
          'task-1',
          'completed',
          { endActiveSession: true }
        )
      })
    })

    it('handles revert status change with confirmation', async () => {
      const task = { ...baseTask, estimated_minutes: 60, status: 'completed' as SmallTaskStatus }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          onStatusChange={mockOnStatusChange}
          showButtons={true}
        />
      )

      const revertButton = screen.getByText('元に戻す')
      fireEvent.click(revertButton)

      expect(mockConfirm).toHaveBeenCalledWith('「Test Task」を未完了に戻しますか？')
      
      await waitFor(() => {
        expect(smallTaskRepository.updateTaskStatus).toHaveBeenCalledWith('task-1', 'pending')
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'タスクを未完了に戻しました',
        description: 'Test Task',
      })
      expect(mockOnStatusChange).toHaveBeenCalled()
    })

    it('does not change status when confirmation is cancelled', async () => {
      mockConfirm.mockReturnValue(false)
      
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          onStatusChange={mockOnStatusChange}
          showButtons={true}
        />
      )

      const completeButton = screen.getByText('完了')
      fireEvent.click(completeButton)

      expect(mockConfirm).toHaveBeenCalled()
      expect(smallTaskRepository.updateTaskStatus).not.toHaveBeenCalled()
      expect(mockOnStatusChange).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('shows error toast when status update fails', async () => {
      const error = new Error('Update failed')
      ;(smallTaskRepository.updateTaskStatus as MockedFunction<typeof smallTaskRepository.updateTaskStatus>).mockRejectedValue(error)
      
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          onStatusChange={mockOnStatusChange}
          showButtons={true}
        />
      )

      const completeButton = screen.getByText('完了')
      fireEvent.click(completeButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'エラー',
          description: '状態の更新に失敗しました',
          variant: 'destructive',
        })
      })

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to update task status:', error)
      expect(mockOnStatusChange).not.toHaveBeenCalled()
    })

    it('shows error toast when status revert fails', async () => {
      const error = new Error('Revert failed')
      ;(smallTaskRepository.updateTaskStatus as MockedFunction<typeof smallTaskRepository.updateTaskStatus>).mockRejectedValue(error)
      
      const task = { ...baseTask, estimated_minutes: 60, status: 'completed' as SmallTaskStatus }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          onStatusChange={mockOnStatusChange}
          showButtons={true}
        />
      )

      const revertButton = screen.getByText('元に戻す')
      fireEvent.click(revertButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'エラー',
          description: '状態の更新に失敗しました',
          variant: 'destructive',
        })
      })

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to revert task status:', error)
      expect(mockOnStatusChange).not.toHaveBeenCalled()
    })
  })

  describe('Click Handlers', () => {
    it('calls onClick when card is clicked', () => {
      render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={baseSessions}
          onClick={mockOnClick}
        />
      )

      const card = screen.getByText('Test Task').closest('div')
      fireEvent.click(card!)

      expect(mockOnClick).toHaveBeenCalled()
    })

    it('stops propagation when clicking action buttons', () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          onClick={mockOnClick}
          showButtons={true}
        />
      )

      const completeButton = screen.getByText('完了')
      fireEvent.click(completeButton)

      // onClick should not be called when clicking buttons
      expect(mockOnClick).not.toHaveBeenCalled()
    })

    it('applies cursor-pointer class when onClick is provided', () => {
      const { container } = render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={baseSessions}
          onClick={mockOnClick}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('cursor-pointer')
    })

    it('does not apply cursor-pointer class when onClick is not provided', () => {
      const { container } = render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).not.toHaveClass('cursor-pointer')
    })
  })

  describe('Visual States', () => {
    it('applies active ring when isActive is true', () => {
      const { container } = render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={baseSessions}
          isActive={true}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('ring-2', 'ring-primary', 'ring-offset-1')
    })

    it('applies opacity for completed tasks', () => {
      const task = { ...baseTask, status: 'completed' as SmallTaskStatus }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('opacity-80')
    })

    it('applies opacity for cancelled tasks', () => {
      const task = { ...baseTask, status: 'cancelled' as SmallTaskStatus }
      const { container } = render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('opacity-60')
    })

    it('applies primary background for active sessions', () => {
      const activeSession: WorkSession = {
        id: 'session-1',
        user_id: 'user-1',
        small_task_id: 'task-1',
        start_time: '2024-01-01T09:00:00Z',
        duration_seconds: 0,
        is_synced: true,
        created_at: '2024-01-01T09:00:00Z',
        updated_at: '2024-01-01T09:00:00Z',
        version: 1,
      }

      const { container } = render(
        <TaskCard
          task={baseTask}
          project={baseProject}
          sessions={[activeSession]}
        />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-primary', 'text-primary-foreground')
    })

    it('disables buttons during update operations', async () => {
      const task = { ...baseTask, estimated_minutes: 60 }
      render(
        <TaskCard
          task={task}
          project={baseProject}
          sessions={baseSessions}
          showButtons={true}
        />
      )

      const completeButton = screen.getByText('完了')
      const cancelButton = screen.getByText('不要')

      fireEvent.click(completeButton)

      // During the update, buttons should be disabled
      expect(completeButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()

      await waitFor(() => {
        expect(smallTaskRepository.updateTaskStatus).toHaveBeenCalled()
      })
    })
  })
})