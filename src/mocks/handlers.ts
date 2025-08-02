import { http, HttpResponse } from 'msw'
import { createGoal, createWBSTask, generateTestId } from '@/test-utils/test-factories'

/**
 * MSW request handlers for API mocking
 * These handlers intercept HTTP requests during tests
 */

// Base API URL - can be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// In-memory storage for mocked data
const mockDatabase = {
  projects: new Map(),
  smallTasks: new Map(),
  workSessions: new Map(),
  schedules: new Map(),
  goals: new Map(),
}

export const handlers = [
  // Health check endpoint
  http.get(`${API_BASE_URL}/health`, () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  }),

  // Project endpoints
  http.get(`${API_BASE_URL}/projects`, () => {
    const projects = Array.from(mockDatabase.projects.values())
    return HttpResponse.json({
      success: true,
      projects,
      count: projects.length,
    })
  }),

  http.get(`${API_BASE_URL}/projects/:id`, ({ params }) => {
    const project = mockDatabase.projects.get(params.id as string)
    if (!project) {
      return HttpResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }
    return HttpResponse.json({
      success: true,
      project,
    })
  }),

  http.post(`${API_BASE_URL}/projects`, async ({ request }) => {
    const body = await request.json() as any
    const project = {
      id: generateTestId('proj'),
      user_id: 'test-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: false,
      ...body,
    }
    mockDatabase.projects.set(project.id, project)
    return HttpResponse.json({
      success: true,
      project,
    })
  }),

  http.put(`${API_BASE_URL}/projects/:id`, async ({ request, params }) => {
    const body = await request.json() as any
    const existing = mockDatabase.projects.get(params.id as string)
    if (!existing) {
      return HttpResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }
    const updated = {
      ...existing,
      ...body,
      updated_at: new Date().toISOString(),
      version: existing.version + 1,
    }
    mockDatabase.projects.set(params.id as string, updated)
    return HttpResponse.json({
      success: true,
      project: updated,
    })
  }),

  http.delete(`${API_BASE_URL}/projects/:id`, ({ params }) => {
    const existed = mockDatabase.projects.has(params.id as string)
    if (!existed) {
      return HttpResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }
    mockDatabase.projects.delete(params.id as string)
    return HttpResponse.json({
      success: true,
      message: 'Project deleted successfully',
    })
  }),

  // Small task endpoints
  http.get(`${API_BASE_URL}/small-tasks`, ({ request }) => {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('project_id')
    
    let tasks = Array.from(mockDatabase.smallTasks.values())
    if (projectId) {
      tasks = tasks.filter(task => task.project_id === projectId)
    }
    
    return HttpResponse.json({
      success: true,
      tasks,
      count: tasks.length,
    })
  }),

  http.post(`${API_BASE_URL}/small-tasks`, async ({ request }) => {
    const body = await request.json() as any
    const task = {
      id: generateTestId('task'),
      user_id: 'test-user',
      status: 'pending',
      is_emergency: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: false,
      ...body,
    }
    mockDatabase.smallTasks.set(task.id, task)
    return HttpResponse.json({
      success: true,
      task,
    })
  }),

  http.put(`${API_BASE_URL}/small-tasks/:id/status`, async ({ request, params }) => {
    const body = await request.json() as { status: string, endActiveSession?: boolean }
    const task = mockDatabase.smallTasks.get(params.id as string)
    if (!task) {
      return HttpResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }
    
    task.status = body.status
    task.updated_at = new Date().toISOString()
    task.version += 1
    
    // End active session if requested
    if (body.endActiveSession) {
      const sessions = Array.from(mockDatabase.workSessions.values())
      const activeSession = sessions.find(s => s.small_task_id === params.id && !s.end_time)
      if (activeSession) {
        activeSession.end_time = new Date().toISOString()
        activeSession.duration_seconds = Math.floor((Date.now() - new Date(activeSession.start_time).getTime()) / 1000)
      }
    }
    
    return HttpResponse.json({
      success: true,
      task,
    })
  }),

  // Work session endpoints
  http.get(`${API_BASE_URL}/work-sessions`, ({ request }) => {
    const url = new URL(request.url)
    const taskId = url.searchParams.get('small_task_id')
    
    let sessions = Array.from(mockDatabase.workSessions.values())
    if (taskId) {
      sessions = sessions.filter(session => session.small_task_id === taskId)
    }
    
    return HttpResponse.json({
      success: true,
      sessions,
      count: sessions.length,
    })
  }),

  http.post(`${API_BASE_URL}/work-sessions/start`, async ({ request }) => {
    const body = await request.json() as { small_task_id: string }
    
    // End any active sessions
    const sessions = Array.from(mockDatabase.workSessions.values())
    const activeSession = sessions.find(s => !s.end_time)
    if (activeSession) {
      activeSession.end_time = new Date().toISOString()
      activeSession.duration_seconds = Math.floor((Date.now() - new Date(activeSession.start_time).getTime()) / 1000)
    }
    
    const session = {
      id: generateTestId('session'),
      user_id: 'test-user',
      small_task_id: body.small_task_id,
      start_time: new Date().toISOString(),
      duration_seconds: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: false,
    }
    mockDatabase.workSessions.set(session.id, session)
    
    return HttpResponse.json({
      success: true,
      session,
    })
  }),

  http.post(`${API_BASE_URL}/work-sessions/:id/stop`, ({ params }) => {
    const session = mockDatabase.workSessions.get(params.id as string)
    if (!session) {
      return HttpResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }
    
    if (!session.end_time) {
      session.end_time = new Date().toISOString()
      session.duration_seconds = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000)
      session.updated_at = new Date().toISOString()
      session.version += 1
    }
    
    return HttpResponse.json({
      success: true,
      session,
    })
  }),

  // Schedule endpoints
  http.get(`${API_BASE_URL}/schedules/:weekOf`, ({ params }) => {
    const weekOf = params.weekOf as string
    const schedule = mockDatabase.schedules.get(weekOf) || {
      id: generateTestId('schedule'),
      user_id: 'test-user',
      week_of: weekOf,
      scheduled_tasks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: false,
    }
    
    return HttpResponse.json({
      success: true,
      schedule,
    })
  }),

  http.put(`${API_BASE_URL}/schedules/:weekOf`, async ({ request, params }) => {
    const body = await request.json() as any
    const weekOf = params.weekOf as string
    
    const schedule = {
      id: generateTestId('schedule'),
      user_id: 'test-user',
      week_of: weekOf,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: false,
      ...body,
    }
    
    mockDatabase.schedules.set(weekOf, schedule)
    
    return HttpResponse.json({
      success: true,
      schedule,
    })
  }),

  // Goal endpoints
  http.get(`${API_BASE_URL}/goals`, () => {
    const goals = Array.from(mockDatabase.goals.values())
    return HttpResponse.json({
      success: true,
      goals,
      count: goals.length,
    })
  }),

  http.post(`${API_BASE_URL}/goals`, async ({ request }) => {
    const body = await request.json() as any
    const goal = {
      id: generateTestId('goal'),
      user_id: 'test-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_synced: false,
      ...body,
    }
    mockDatabase.goals.set(goal.id, goal)
    return HttpResponse.json({
      success: true,
      goal,
    })
  }),

  // Reverse WBS AI suggestion endpoint
  http.post(`${API_BASE_URL}/reverse-wbs/suggest`, async ({ request }) => {
    const body = await request.json() as { goal: string }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // Mock response with suggested tasks
    return HttpResponse.json({
      success: true,
      tasks: [
        {
          id: 'task-1',
          name: '要件定義',
          level: 1,
          estimatedHours: 8,
          children: [
            {
              id: 'task-1-1',
              name: 'ユーザーストーリー作成',
              level: 2,
              estimatedHours: 4,
            },
            {
              id: 'task-1-2',
              name: '機能要件定義',
              level: 2,
              estimatedHours: 4,
            },
          ],
        },
        {
          id: 'task-2',
          name: '設計',
          level: 1,
          estimatedHours: 16,
          children: [
            {
              id: 'task-2-1',
              name: 'アーキテクチャ設計',
              level: 2,
              estimatedHours: 8,
            },
            {
              id: 'task-2-2',
              name: 'データベース設計',
              level: 2,
              estimatedHours: 8,
            },
          ],
        },
      ],
    })
  }),

  // Reverse WBS validation endpoint
  http.post(`${API_BASE_URL}/reverse-wbs/validate`, async ({ request }) => {
    const body = await request.json() as { tasks: any[], dependencies: any[] }

    // Mock validation response
    return HttpResponse.json({
      success: true,
      valid: true,
      errors: [],
    })
  }),

  // Reverse WBS convert to project endpoint
  http.post(`${API_BASE_URL}/reverse-wbs/convert`, async ({ request }) => {
    const body = await request.json() as { wbs: any }

    // Mock conversion response
    return HttpResponse.json({
      success: true,
      projectId: 'proj_' + Date.now(),
      message: 'WBS successfully converted to project',
    })
  }),

  // Sync API endpoint
  http.post(`${API_BASE_URL}/sync`, async ({ request }) => {
    const authHeader = request.headers.get('x-api-key')
    
    // Check API key
    if (!authHeader) {
      return HttpResponse.json(
        { success: false, error: 'API key is required. Please provide x-api-key header.' },
        { status: 401 }
      )
    }

    if (authHeader !== 'test-api-key') {
      return HttpResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      )
    }

    const body = await request.json() as { entity_type: string, payload: any }

    // Validate required fields
    if (!body.entity_type || !body.payload) {
      return HttpResponse.json(
        { success: false, error: 'entity_type and payload are required' },
        { status: 400 }
      )
    }

    // Mock successful sync
    return HttpResponse.json({
      success: true,
      syncedEntityId: body.payload.id || 'mock_id_' + Date.now(),
      syncedEntityType: body.entity_type,
    })
  }),

  // Catch-all handler for unhandled requests (useful for debugging)
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return new HttpResponse(null, { status: 404 })
  }),
]

/**
 * Reset mock database for testing
 */
export function resetMockDatabase() {
  mockDatabase.projects.clear()
  mockDatabase.smallTasks.clear()
  mockDatabase.workSessions.clear()
  mockDatabase.schedules.clear()
  mockDatabase.goals.clear()
}

/**
 * Seed mock database with test data
 */
export function seedMockDatabase(data: {
  projects?: any[]
  smallTasks?: any[]
  workSessions?: any[]
  schedules?: any[]
  goals?: any[]
}) {
  if (data.projects) {
    data.projects.forEach(p => mockDatabase.projects.set(p.id, p))
  }
  if (data.smallTasks) {
    data.smallTasks.forEach(t => mockDatabase.smallTasks.set(t.id, t))
  }
  if (data.workSessions) {
    data.workSessions.forEach(s => mockDatabase.workSessions.set(s.id, s))
  }
  if (data.schedules) {
    data.schedules.forEach(s => mockDatabase.schedules.set(s.week_of, s))
  }
  if (data.goals) {
    data.goals.forEach(g => mockDatabase.goals.set(g.id, g))
  }
}