/**
 * useTimer - Custom hook for timer operations with offline support
 * Handles work session timers and time tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { workSessionRepository, taskRepository, projectRepository } from '@/lib/db/repositories'
import { useTimerStore } from '@/stores/timer-store'
import { SyncService } from '@/lib/sync/sync-service'
import { queryKeys, invalidateQueries } from '@/lib/query/query-client'
import { WorkSession, CreateWorkSessionData } from '@/types'
import { generateId } from '@/lib/utils'

const syncService = SyncService.getInstance()

export function useTimer(userId: string) {
  const queryClient = useQueryClient()
  const timerStore = useTimerStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Get active session and restore timer state
  const activeSessionQuery = useQuery({
    queryKey: queryKeys.activeSession(userId),
    queryFn: async () => {
      const session = await workSessionRepository.getActiveSession(userId)
      if (session && !timerStore.activeSession) {
        // セッションが存在し、タイマーストアにまだ設定されていない場合
        // 経過時間を計算
        const startTime = new Date(session.start_time)
        const now = new Date()
        const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        
        // タスクとプロジェクトの情報を取得
        let task = null
        let project = null
        if (session.small_task_id) {
          try {
            const taskData = await taskRepository.getById(session.small_task_id)
            task = taskData
            if (taskData?.project_id) {
              const projectData = await projectRepository.getById(taskData.project_id)
              project = projectData
            }
          } catch (error) {
            console.error('Failed to restore task/project:', error)
          }
        }
        
        // タイマーを復元
        timerStore.startTimer(session, task, project)
        // 経過時間を更新
        timerStore.updateElapsedTime(elapsedSeconds)
      }
      return session || null  // undefinedの代わりにnullを返す
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!userId,
  })

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async (data?: { taskId?: string; taskDescription?: string }) => {
      const sessionData: CreateWorkSessionData = {
        user_id: userId,
        small_task_id: data?.taskId,
        task_description: data?.taskDescription,
        start_time: new Date().toISOString(),
        duration_minutes: 0,
        is_synced: false,
      }

      const session = await workSessionRepository.startSession(
        userId, 
        data?.taskId,
        undefined,
        data?.taskDescription
      )
      // 開発中は自動同期を無効化（手動で同期キューに追加）
      // await syncService.addToSyncQueue('work_session', session.id, 'create', session)

      timerStore.startTimer(session)
      return session
    },
    onSuccess: () => {
      invalidateQueries.activeSession(userId)
      invalidateQueries.workSessions()
    },
  })

  // End timer mutation
  const endTimerMutation = useMutation({
    mutationFn: async (data?: { focusLevel?: number }) => {
      const { activeSession, focusLevel, moodNotes } = timerStore
      if (!activeSession) {
        throw new Error('No active session')
      }

      const finalFocusLevel = data?.focusLevel ?? focusLevel
      const session = await workSessionRepository.endSession(
        activeSession.id,
        undefined,
        finalFocusLevel || undefined
      )

      // Add mood notes if present
      if (moodNotes.trim()) {
        await workSessionRepository.addMoodNotes(session.id, moodNotes)
      }

      // 開発中は自動同期を無効化（手動で同期キューに追加）
      // await syncService.addToSyncQueue('work_session', session.id, 'update', session)

      timerStore.stopTimer()
      return session
    },
    onSuccess: () => {
      invalidateQueries.activeSession(userId)
      invalidateQueries.workSessions()
    },
  })

  // Pause timer mutation
  const pauseTimerMutation = useMutation({
    mutationFn: async () => {
      const { activeSession } = timerStore
      if (!activeSession) {
        throw new Error('No active session')
      }

      const session = await workSessionRepository.pauseSession(activeSession.id)
      // 開発中は自動同期を無効化（手動で同期キューに追加）
      // await syncService.addToSyncQueue('work_session', session.id, 'update', session)

      timerStore.pauseTimer()
      return session
    },
    onSuccess: () => {
      invalidateQueries.activeSession(userId)
    },
  })

  // Resume timer mutation
  const resumeTimerMutation = useMutation({
    mutationFn: async () => {
      const { activeSession } = timerStore
      if (!activeSession) {
        throw new Error('No active session')
      }

      const session = await workSessionRepository.resumeSession(activeSession.id)
      // 開発中は自動同期を無効化（手動で同期キューに追加）
      // await syncService.addToSyncQueue('work_session', session.id, 'update', session)

      timerStore.resumeTimer()
      return session
    },
    onSuccess: () => {
      invalidateQueries.activeSession(userId)
    },
  })

  // Update focus level mutation
  const updateFocusLevelMutation = useMutation({
    mutationFn: async (focusLevel: number) => {
      const { activeSession } = timerStore
      if (!activeSession) {
        throw new Error('No active session')
      }

      const session = await workSessionRepository.updateFocusLevel(activeSession.id, focusLevel)
      // 開発中は自動同期を無効化（手動で同期キューに追加）
      // await syncService.addToSyncQueue('work_session', session.id, 'update', session)

      timerStore.setFocusLevel(focusLevel)
      return session
    },
  })

  // Timer interval effect
  useEffect(() => {
    if (timerStore.isRunning && timerStore.startTime) {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStore.startTime!.getTime()) / 1000)
        timerStore.updateElapsedTime(elapsed)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [timerStore.isRunning, timerStore.startTime, timerStore])

  // Auto-save timer state periodically
  useEffect(() => {
    if (!timerStore.isRunning || !timerStore.activeSession) return

    const autoSaveInterval = setInterval(async () => {
      try {
        await workSessionRepository.pauseSession(timerStore.activeSession!.id)
        // 開発中は自動同期を無効化
        // await syncService.addToSyncQueue('work_session', timerStore.activeSession!.id, 'update')
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, 30000) // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval)
  }, [timerStore.isRunning, timerStore.activeSession, timerStore])

  return {
    // Timer state
    activeSession: timerStore.activeSession,
    isRunning: timerStore.isRunning,
    elapsedTime: timerStore.elapsedTime,
    formattedTime: timerStore.getFormattedTime(),
    sessionDuration: timerStore.getSessionDuration(),
    focusLevel: timerStore.focusLevel,
    moodNotes: timerStore.moodNotes,
    isOffline: timerStore.isOffline,

    // Timer actions
    startTimer: startTimerMutation.mutate,
    endTimer: endTimerMutation.mutate,
    pauseTimer: pauseTimerMutation.mutate,
    resumeTimer: resumeTimerMutation.mutate,
    resetTimer: timerStore.resetTimer,

    // Timer mutations
    updateFocusLevel: updateFocusLevelMutation.mutate,
    setMoodNotes: timerStore.setMoodNotes,

    // Mutation states
    isStarting: startTimerMutation.isPending,
    isEnding: endTimerMutation.isPending,
    isPausing: pauseTimerMutation.isPending,
    isResuming: resumeTimerMutation.isPending,
    isUpdatingFocus: updateFocusLevelMutation.isPending,

    // Utility functions
    isSessionActive: timerStore.isSessionActive,
    canStartNewSession: timerStore.canStartNewSession,

    // Query state
    isLoadingActiveSession: activeSessionQuery.isLoading,
    activeSessionError: activeSessionQuery.error,
    refetchActiveSession: activeSessionQuery.refetch,
  }
}

export function useWorkSessions(userId: string, date?: string) {
  return useQuery({
    queryKey: date ? queryKeys.workSessionsByDate(userId, date) : queryKeys.workSessions(),
    queryFn: async () => {
      if (date) {
        return await workSessionRepository.getSessionsForDate(userId, date)
      } else {
        return await workSessionRepository.getByUserId(userId)
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
  })
}

export function useWorkSessionsByTask(taskId: string) {
  return useQuery({
    queryKey: queryKeys.workSessionsByTask(taskId),
    queryFn: () => workSessionRepository.getByTaskId(taskId),
    staleTime: 5 * 60 * 1000,
    enabled: !!taskId,
  })
}
