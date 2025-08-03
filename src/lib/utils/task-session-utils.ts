/**
 * Utility functions for managing the relationship between SmallTasks and WorkSessions
 */

import { SmallTask, WorkSession } from '@/types'

/**
 * Check if a task is currently active (has an ongoing work session)
 */
export function isTaskActive(taskId: string, sessions: WorkSession[]): boolean {
  return sessions.some(
    session => session.small_task_id === taskId && session.start_time && !session.end_time
  )
}

/**
 * Check if a task has been completed (has at least one completed work session)
 */
export function isTaskCompleted(taskId: string, sessions: WorkSession[]): boolean {
  return sessions.some(
    session => session.small_task_id === taskId && session.end_time !== undefined
  )
}

/**
 * Get the total minutes worked on a task across all sessions
 */
export function getTaskTotalMinutes(taskId: string, sessions: WorkSession[]): number {
  const totalSeconds = sessions
    .filter(session => session.small_task_id === taskId && session.duration_seconds > 0)
    .reduce((total, session) => total + session.duration_seconds, 0)
  return Math.floor(totalSeconds / 60)
}

/**
 * Get the first start time of a task
 */
export function getTaskStartTime(taskId: string, sessions: WorkSession[]): string | undefined {
  const taskSessions = sessions
    .filter(session => session.small_task_id === taskId && session.start_time)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return taskSessions[0]?.start_time
}

/**
 * Get the last end time of a task
 */
export function getTaskEndTime(taskId: string, sessions: WorkSession[]): string | undefined {
  const completedSessions = sessions
    .filter(session => session.small_task_id === taskId && session.end_time)
    .sort((a, b) => (b.end_time || '').localeCompare(a.end_time || ''))

  return completedSessions[0]?.end_time
}

/**
 * Get the active session for a task
 */
export function getTaskActiveSession(
  taskId: string,
  sessions: WorkSession[]
): WorkSession | undefined {
  return sessions.find(
    session => session.small_task_id === taskId && session.start_time && !session.end_time
  )
}

/**
 * Calculate variance ratio based on estimated minutes and actual work time
 */
export function calculateVarianceRatio(estimatedMinutes: number, actualMinutes: number): number {
  if (estimatedMinutes === 0) return 0
  return actualMinutes / estimatedMinutes
}

/**
 * Get tasks with their session information
 */
export interface TaskWithSessions {
  task: SmallTask
  sessions: WorkSession[]
  totalMinutes: number
  isActive: boolean
  isCompleted: boolean
  startTime?: string
  endTime?: string
}

export function enrichTasksWithSessions(
  tasks: SmallTask[],
  sessions: WorkSession[]
): TaskWithSessions[] {
  return tasks.map(task => ({
    task,
    sessions: sessions.filter(s => s.small_task_id === task.id),
    totalMinutes: getTaskTotalMinutes(task.id, sessions),
    isActive: isTaskActive(task.id, sessions),
    isCompleted: isTaskCompleted(task.id, sessions),
    startTime: getTaskStartTime(task.id, sessions),
    endTime: getTaskEndTime(task.id, sessions),
  }))
}

/**
 * Get display information for a task based on its status and sessions
 */
export interface TaskDisplayInfo {
  statusText: string
  progressText?: string
  colorClass: string
  hasActiveSession: boolean
  totalMinutes: number
}

export function getTaskDisplayInfo(task: SmallTask, sessions: WorkSession[]): TaskDisplayInfo {
  const totalMinutes = getTaskTotalMinutes(task.id, sessions)
  const hasActiveSession = isTaskActive(task.id, sessions)
  const status = task.status || 'pending'

  // Status text based on task state
  const statusTextMap = {
    pending: hasActiveSession ? '作業中' : totalMinutes > 0 ? '一時中断' : '未着手',
    completed: '完了',
    cancelled: '不要',
  }

  // Color classes based on status and session state
  const colorClassMap = {
    pending: hasActiveSession
      ? 'bg-primary'
      : totalMinutes > 0
        ? 'bg-muted-foreground'
        : 'bg-muted',
    completed: 'bg-muted',
    cancelled: 'bg-muted/50',
  }

  return {
    statusText: statusTextMap[status],
    progressText:
      status === 'pending' && totalMinutes > 0
        ? `${totalMinutes}/${task.estimated_minutes}分`
        : undefined,
    colorClass: colorClassMap[status],
    hasActiveSession,
    totalMinutes,
  }
}
