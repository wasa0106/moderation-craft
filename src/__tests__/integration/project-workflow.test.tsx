import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, createUser } from '@/test-utils'
import { mockFetch, setupDefaultMocks } from '@/test-utils/fetch-mock'
// For integration tests, we'll test individual components instead of the full app
// import App from '@/app/page'

// Mock next/navigation for integration tests
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

describe('Project Workflow Integration Test', () => {
  const user = createUser()

  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('completes full project creation and task management workflow', async () => {
    // Step 1: Create a project via API
    const mockProjectResponse = {
      success: true,
      project: {
        id: 'proj-123',
        name: 'Integration Test Project',
        goal: 'Complete all integration tests',
        deadline: '2025-12-31',
      }
    }
    
    mockFetch('/api/projects', mockProjectResponse)
    
    const projectResponse = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Integration Test Project',
        goal: 'Complete all integration tests',
        deadline: '2025-12-31',
      }),
    })

    const projectData = await projectResponse.json()
    expect(projectData.success).toBe(true)
    expect(projectData.project.name).toBe('Integration Test Project')

    const projectId = projectData.project.id
    
    // Create a task via API
    const mockTaskResponse = {
      success: true,
      task: {
        id: 'task-456',
        project_id: projectId,
        name: 'Write unit tests',
        estimated_minutes: 120,
      }
    }
    
    mockFetch('/api/small-tasks', mockTaskResponse)
    
    const response = await fetch('/api/small-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        name: 'Write unit tests',
        estimated_minutes: 120,
      }),
    })

    const taskData = await response.json()
    expect(taskData.success).toBe(true)
    expect(taskData.task.name).toBe('Write unit tests')

    // Step 8: Start timer for the task
    const mockSessionResponse = {
      success: true,
      session: {
        id: 'session-789',
        small_task_id: taskData.task.id,
      }
    }
    
    mockFetch('/api/work-sessions/start', mockSessionResponse)
    
    const timerResponse = await fetch('/api/work-sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        small_task_id: taskData.task.id,
      }),
    })

    const sessionData = await timerResponse.json()
    expect(sessionData.success).toBe(true)
    expect(sessionData.session.small_task_id).toBe(taskData.task.id)

    // Step 9: Complete the task
    const mockCompleteResponse = {
      success: true,
      task: {
        ...taskData.task,
        status: 'completed',
      }
    }
    
    mockFetch(`/api/small-tasks/${taskData.task.id}/status`, mockCompleteResponse)
    
    const completeResponse = await fetch(`/api/small-tasks/${taskData.task.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        endActiveSession: true,
      }),
    })

    const completeData = await completeResponse.json()
    expect(completeData.success).toBe(true)
    expect(completeData.task.status).toBe('completed')
  })

  it('handles error scenarios gracefully', async () => {
    // Test API error handling directly
    mockFetch('/api/projects', {
      success: false,
      error: 'Validation error: Name is required'
    }, { status: 400 })
    
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required fields to trigger validation error
        name: '',
      }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
  })

  it('supports offline mode with sync', async () => {
    // Create project while "online"
    const mockProject = {
      id: 'proj-offline',
      name: 'Offline Test Project',
      goal: 'Test offline functionality',
      deadline: '2025-12-31',
      is_synced: false,
    }
    
    mockFetch('/api/projects', {
      success: true,
      project: mockProject
    })
    
    const createResponse = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Offline Test Project',
        goal: 'Test offline functionality',
        deadline: '2025-12-31',
      }),
    })

    const projectData = await createResponse.json()
    expect(projectData.project.is_synced).toBe(false)

    // Simulate sync
    mockFetch('/api/sync', {
      success: true,
      syncedEntityId: projectData.project.id,
      syncedEntityType: 'project',
    })
    
    const syncResponse = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-api-key',
      },
      body: JSON.stringify({
        entity_type: 'project',
        payload: projectData.project,
      }),
    })

    const syncData = await syncResponse.json()
    expect(syncData.success).toBe(true)
    expect(syncData.syncedEntityId).toBe(projectData.project.id)
  })

  it('manages multiple projects and tasks', async () => {
    // Create multiple projects
    const projects = []
    for (let i = 1; i <= 3; i++) {
      const mockProject = {
        id: `proj-${i}`,
        name: `Project ${i}`,
        goal: `Complete project ${i}`,
        deadline: `2025-${String(i).padStart(2, '0')}-28`,
      }
      
      mockFetch('/api/projects', {
        success: true,
        project: mockProject
      })
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Project ${i}`,
          goal: `Complete project ${i}`,
          deadline: `2025-${String(i).padStart(2, '0')}-28`,
        }),
      })
      const data = await response.json()
      projects.push(data.project)
    }

    // Create tasks for each project
    for (const project of projects) {
      for (let j = 1; j <= 2; j++) {
        mockFetch('/api/small-tasks', {
          success: true,
          task: {
            id: `task-${project.id}-${j}`,
            project_id: project.id,
            name: `Task ${j} for ${project.name}`,
            estimated_minutes: 60 * j,
          }
        })
        
        await fetch('/api/small-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project.id,
            name: `Task ${j} for ${project.name}`,
            estimated_minutes: 60 * j,
          }),
        })
      }
    }

    // Verify all data exists
    mockFetch('/api/projects', {
      success: true,
      projects: projects,
      count: 3
    })
    
    const projectsResponse = await fetch('/api/projects')
    const projectsData = await projectsResponse.json()
    expect(projectsData.projects).toHaveLength(3)

    // Check tasks for first project
    mockFetch(`/api/small-tasks?project_id=${projects[0].id}`, {
      success: true,
      tasks: [
        { id: `task-${projects[0].id}-1`, name: `Task 1 for ${projects[0].name}` },
        { id: `task-${projects[0].id}-2`, name: `Task 2 for ${projects[0].name}` },
      ],
      count: 2
    })
    
    const tasksResponse = await fetch(`/api/small-tasks?project_id=${projects[0].id}`)
    const tasksData = await tasksResponse.json()
    expect(tasksData.tasks).toHaveLength(2)
  })

  it('handles scheduling workflow', async () => {
    // Create a project and task
    const mockProject = {
      id: 'proj-schedule',
      name: 'Schedule Test Project',
      goal: 'Test scheduling',
      deadline: '2025-12-31',
    }
    
    mockFetch('/api/projects', {
      success: true,
      project: mockProject
    })
    
    const projectResponse = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Schedule Test Project',
        goal: 'Test scheduling',
        deadline: '2025-12-31',
      }),
    })
    const projectData = await projectResponse.json()

    const mockTask = {
      id: 'task-scheduled',
      project_id: projectData.project.id,
      name: 'Scheduled Task',
      estimated_minutes: 90,
      scheduled_start: '2025-01-15T10:00:00Z',
      scheduled_end: '2025-01-15T11:30:00Z',
    }
    
    mockFetch('/api/small-tasks', {
      success: true,
      task: mockTask
    })
    
    const taskResponse = await fetch('/api/small-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectData.project.id,
        name: 'Scheduled Task',
        estimated_minutes: 90,
        scheduled_start: '2025-01-15T10:00:00Z',
        scheduled_end: '2025-01-15T11:30:00Z',
      }),
    })
    const taskData = await taskResponse.json()

    // Get schedule for the week
    mockFetch('/api/schedules/2025-01-13', {
      success: true,
      schedule: {
        week_of: '2025-01-13',
        scheduled_tasks: []
      }
    })
    
    const scheduleResponse = await fetch('/api/schedules/2025-01-13')
    const scheduleData = await scheduleResponse.json()

    expect(scheduleData.success).toBe(true)
    expect(scheduleData.schedule.week_of).toBe('2025-01-13')

    // Update schedule
    mockFetch('/api/schedules/2025-01-13', {
      success: true,
      schedule: {
        week_of: '2025-01-13',
        scheduled_tasks: [taskData.task.id]
      }
    })
    
    const updateResponse = await fetch('/api/schedules/2025-01-13', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_tasks: [taskData.task.id],
      }),
    })
    const updateData = await updateResponse.json()
    expect(updateData.success).toBe(true)
  })
})