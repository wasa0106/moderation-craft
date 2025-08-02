import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, createUser } from '@/test-utils'
import { ProjectForm } from '@/components/project/project-form'
import { toast } from 'sonner'
import { mockFetch } from '@/test-utils/fetch-mock'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock router
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('ProjectForm', () => {
  const mockOnSuccess = vi.fn()
  const user = createUser()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form fields correctly', () => {
    render(<ProjectForm />)

    // Check all form fields are present
    expect(screen.getByLabelText('プロジェクト名')).toBeInTheDocument()
    expect(screen.getByLabelText('目標')).toBeInTheDocument()
    expect(screen.getByLabelText('期限')).toBeInTheDocument()
    expect(screen.getByText('保存')).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(<ProjectForm />)

    // Try to submit empty form
    const submitButton = screen.getByText('保存')
    await user.click(submitButton)

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText('プロジェクト名を入力してください')).toBeInTheDocument()
      expect(screen.getByText('目標を入力してください')).toBeInTheDocument()
      expect(screen.getByText('期限を入力してください')).toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    // Mock successful API response
    mockFetch('/api/projects', {
      success: true,
      project: {
        id: 'proj-123',
        name: 'New Test Project',
        goal: 'Complete all test tasks',
        deadline: '2025-12-31',
      }
    })
    
    render(<ProjectForm onSuccess={mockOnSuccess} />)

    // Fill in form fields
    await user.type(screen.getByLabelText('プロジェクト名'), 'New Test Project')
    await user.type(screen.getByLabelText('目標'), 'Complete all test tasks')
    await user.type(screen.getByLabelText('期限'), '2025-12-31')

    // Submit form
    await user.click(screen.getByText('保存'))

    // Wait for submission
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('プロジェクトを作成しました')
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  it('handles API errors gracefully', async () => {
    // Mock API to return error
    mockFetch('/api/projects', 
      { success: false, error: 'Server error' },
      { status: 500 }
    )

    render(<ProjectForm />)

    // Fill and submit form
    await user.type(screen.getByLabelText('プロジェクト名'), 'Test Project')
    await user.type(screen.getByLabelText('目標'), 'Test goal')
    await user.type(screen.getByLabelText('期限'), '2025-12-31')
    await user.click(screen.getByText('保存'))

    // Check error handling
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('プロジェクトの作成に失敗しました')
      expect(mockOnSuccess).not.toHaveBeenCalled()
    })
  })

  it('disables submit button during submission', async () => {
    render(<ProjectForm />)

    // Fill form
    await user.type(screen.getByLabelText('プロジェクト名'), 'Test Project')
    await user.type(screen.getByLabelText('目標'), 'Test goal')
    await user.type(screen.getByLabelText('期限'), '2025-12-31')

    // Submit form
    const submitButton = screen.getByText('保存')
    await user.click(submitButton)

    // Button should be disabled immediately
    expect(submitButton).toBeDisabled()

    // Wait for submission to complete
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
    })
  })

  it('updates existing project when in edit mode', async () => {
    const existingProject = {
      id: 'proj-123',
      name: 'Existing Project',
      goal: 'Existing goal',
      deadline: '2025-06-30',
      status: 'active' as const,
    }

    render(<ProjectForm project={existingProject} onSuccess={mockOnSuccess} />)

    // Check form is pre-filled
    expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing goal')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2025-06-30')).toBeInTheDocument()

    // Update a field
    const nameInput = screen.getByLabelText('プロジェクト名')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Project')

    // Submit form
    await user.click(screen.getByText('保存'))

    // Check update was called
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('プロジェクトを更新しました')
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  it('validates deadline is in the future', async () => {
    render(<ProjectForm />)

    // Fill form with past date
    await user.type(screen.getByLabelText('プロジェクト名'), 'Test Project')
    await user.type(screen.getByLabelText('目標'), 'Test goal')
    await user.type(screen.getByLabelText('期限'), '2020-01-01')

    // Submit form
    await user.click(screen.getByText('保存'))

    // Check validation error
    await waitFor(() => {
      expect(screen.getByText('期限は今日以降の日付を選択してください')).toBeInTheDocument()
    })
  })

  it('shows character count for goal field', async () => {
    render(<ProjectForm />)

    const goalInput = screen.getByLabelText('目標')
    
    // Type in goal field
    await user.type(goalInput, 'This is a test goal')

    // Check character count is displayed
    expect(screen.getByText('19/200')).toBeInTheDocument()
  })

  it('prevents submitting when character limit exceeded', async () => {
    render(<ProjectForm />)

    // Fill form with very long goal
    const longGoal = 'a'.repeat(201)
    await user.type(screen.getByLabelText('プロジェクト名'), 'Test Project')
    await user.type(screen.getByLabelText('目標'), longGoal)
    await user.type(screen.getByLabelText('期限'), '2025-12-31')

    // Submit form
    await user.click(screen.getByText('保存'))

    // Check validation error
    await waitFor(() => {
      expect(screen.getByText('目標は200文字以内で入力してください')).toBeInTheDocument()
    })
  })
})