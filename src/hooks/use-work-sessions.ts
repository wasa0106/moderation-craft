/**
 * useWorkSessions - Hook for managing work sessions
 */

import { useState, useEffect, useCallback } from 'react'
import { WorkSession } from '@/types'
import { workSessionRepository } from '@/lib/db/repositories/session-repository'

export function useWorkSessions(userId: string) {
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load all sessions for the user
  const loadSessions = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const userSessions = await workSessionRepository.getByUserId(userId)
      setSessions(userSessions)
      setError(null)
    } catch (err) {
      console.error('Failed to load work sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Load sessions by date range
  const loadSessionsByDateRange = useCallback(
    async (startDate: string, endDate: string) => {
      if (!userId) return

      try {
        setIsLoading(true)
        const rangeSessions = await workSessionRepository.getByDateRange(userId, startDate, endDate)
        setSessions(rangeSessions)
        setError(null)
      } catch (err) {
        console.error('Failed to load work sessions by date range:', err)
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
      } finally {
        setIsLoading(false)
      }
    },
    [userId]
  )

  // Get sessions for a specific task
  const getTaskSessions = useCallback(
    (taskId: string) => {
      return sessions.filter(session => session.small_task_id === taskId)
    },
    [sessions]
  )

  // Get active session
  const getActiveSession = useCallback(() => {
    return sessions.find(session => session.start_time && !session.end_time)
  }, [sessions])

  // Initial load
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  return {
    sessions,
    isLoading,
    error,
    loadSessions,
    loadSessionsByDateRange,
    getTaskSessions,
    getActiveSession,
  }
}
