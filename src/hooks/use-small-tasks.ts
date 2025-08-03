/**
 * useSmallTasks - Small tasks management hook
 * Provides CRUD operations for small tasks with optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { smallTaskRepository } from '@/lib/db/repositories'
import { SyncService } from '@/lib/sync/sync-service'
import { queryKeys, invalidateQueries } from '@/lib/query/query-client'
import { SmallTask, CreateSmallTaskData, UpdateSmallTaskData } from '@/types'
import { db } from '@/lib/db/database'

const syncService = SyncService.getInstance()

export function useSmallTasks(userId: string, bigTaskId?: string, date?: string) {
  const queryClient = useQueryClient()

  // Fetch small tasks query
  const smallTasksQuery = useQuery({
    queryKey: bigTaskId
      ? queryKeys.smallTasksByBigTask(bigTaskId)
      : date
        ? queryKeys.smallTasksByDate(userId, date)
        : queryKeys.activeTasks(userId),
    queryFn: async () => {
      try {
        if (bigTaskId) {
          return await smallTaskRepository.getByBigTaskId(bigTaskId)
        } else if (date) {
          return await smallTaskRepository.getScheduledForDate(userId, date)
        } else {
          return await smallTaskRepository.getActiveTasks(userId)
        }
      } catch (error) {
        console.error('Failed to get small tasks:', error)

        // データベースエラーの場合は復旧を試行
        if (
          error instanceof Error &&
          (error.message.includes('UpgradeError') ||
            error.message.includes('DatabaseClosedError') ||
            error.message.includes('primary key'))
        ) {
          console.warn('Database schema error detected, attempting recovery...')
          try {
            await db.handleSchemaError()
            // 復旧後に再試行
            if (bigTaskId) {
              return await smallTaskRepository.getByBigTaskId(bigTaskId)
            } else if (date) {
              return await smallTaskRepository.getScheduledForDate(userId, date)
            } else {
              return await smallTaskRepository.getActiveTasks(userId)
            }
          } catch (recoveryError) {
            console.error('Database recovery failed:', recoveryError)
            throw new Error('データベースの復旧に失敗しました。ページをリロードしてください。')
          }
        }

        throw error
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
    retry: (failureCount, error) => {
      // データベースエラーの場合は自動リトライしない
      if (
        error instanceof Error &&
        (error.message.includes('UpgradeError') ||
          error.message.includes('DatabaseClosedError') ||
          error.message.includes('primary key'))
      ) {
        return false
      }
      return failureCount < 3
    },
  })

  // Create small task mutation
  const createSmallTaskMutation = useMutation({
    mutationFn: async (data: CreateSmallTaskData) => {
      const createdSmallTask = await smallTaskRepository.create(data)
      await syncService.addToSyncQueue(
        'small_task',
        createdSmallTask.id,
        'create',
        createdSmallTask
      )
      return createdSmallTask
    },
    onSuccess: smallTask => {
      if (bigTaskId) {
        invalidateQueries.smallTasksByBigTask(bigTaskId)
      }
      if (date) {
        invalidateQueries.smallTasksByDate(userId, date)
      }
      invalidateQueries.activeTasks(userId)

      // date-rangeクエリも無効化
      queryClient.invalidateQueries({
        queryKey: ['small-tasks', 'date-range'],
        refetchType: 'active',
      })
    },
    onError: error => {
      console.error('Failed to create small task:', error)
    },
  })

  // Update small task mutation
  const updateSmallTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSmallTaskData }) => {
      const result = await smallTaskRepository.update(id, data)
      await syncService.addToSyncQueue('small_task', id, 'update', result)
      return result
    },
    onSuccess: smallTask => {
      invalidateQueries.smallTask(smallTask.id)
      if (bigTaskId) {
        invalidateQueries.smallTasksByBigTask(bigTaskId)
      }
      if (date) {
        invalidateQueries.smallTasksByDate(userId, date)
      }
      invalidateQueries.activeTasks(userId)

      // date-rangeクエリも無効化
      queryClient.invalidateQueries({
        queryKey: ['small-tasks', 'date-range'],
        refetchType: 'active',
      })
    },
    onError: error => {
      console.error('Failed to update small task:', error)
    },
  })

  // Delete small task mutation
  const deleteSmallTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await smallTaskRepository.delete(id)
      await syncService.addToSyncQueue('small_task', id, 'delete')
    },
    onSuccess: (_, deletedId) => {
      invalidateQueries.smallTask(deletedId)
      if (bigTaskId) {
        invalidateQueries.smallTasksByBigTask(bigTaskId)
      }
      if (date) {
        invalidateQueries.smallTasksByDate(userId, date)
      }
      invalidateQueries.activeTasks(userId)

      // date-rangeクエリも無効化
      queryClient.invalidateQueries({
        queryKey: ['small-tasks', 'date-range'],
        refetchType: 'active',
      })
    },
    onError: error => {
      console.error('Failed to delete small task:', error)
    },
  })

  // Start task mutation
  const startTaskMutation = useMutation({
    mutationFn: async ({ id, startTime }: { id: string; startTime?: string }) => {
      const result = await smallTaskRepository.startTask(id, startTime)
      await syncService.addToSyncQueue('small_task', id, 'update', result)
      return result
    },
    onSuccess: smallTask => {
      invalidateQueries.smallTask(smallTask.id)
      invalidateQueries.activeTasks(userId)
    },
  })

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({
      id,
      endTime,
      focusLevel,
    }: {
      id: string
      endTime?: string
      focusLevel?: number
    }) => {
      const result = await smallTaskRepository.completeTask(id, endTime, focusLevel)
      await syncService.addToSyncQueue('small_task', id, 'update', result)
      return result
    },
    onSuccess: smallTask => {
      invalidateQueries.smallTask(smallTask.id)
      invalidateQueries.activeTasks(userId)
    },
  })

  // Reschedule task mutation
  const rescheduleTaskMutation = useMutation({
    mutationFn: async ({
      id,
      newStartTime,
      newEndTime,
    }: {
      id: string
      newStartTime: string
      newEndTime: string
    }) => {
      const result = await smallTaskRepository.rescheduleTask(id, newStartTime, newEndTime)
      await syncService.addToSyncQueue('small_task', id, 'update', result)
      return result
    },
    onSuccess: smallTask => {
      invalidateQueries.smallTask(smallTask.id)
      if (date) {
        invalidateQueries.smallTasksByDate(userId, date)
      }

      // date-rangeクエリも無効化
      queryClient.invalidateQueries({
        queryKey: ['small-tasks', 'date-range'],
        refetchType: 'active',
      })
    },
  })

  return {
    // Query state
    smallTasks: smallTasksQuery.data || [],
    isLoading: smallTasksQuery.isLoading,
    error: smallTasksQuery.error,

    // Mutations
    createSmallTask: createSmallTaskMutation.mutateAsync,
    updateSmallTask: updateSmallTaskMutation.mutateAsync,
    deleteSmallTask: deleteSmallTaskMutation.mutateAsync,
    startTask: startTaskMutation.mutateAsync,
    completeTask: completeTaskMutation.mutateAsync,
    rescheduleTask: rescheduleTaskMutation.mutateAsync,

    // Mutation states
    isCreating: createSmallTaskMutation.isPending,
    isUpdating: updateSmallTaskMutation.isPending,
    isDeleting: deleteSmallTaskMutation.isPending,

    // Refresh data
    refetch: smallTasksQuery.refetch,
  }
}

export function useSmallTasksByDateRange(userId: string, startDate: string, endDate: string) {
  const smallTasksQuery = useQuery({
    queryKey: ['small-tasks', 'date-range', userId, startDate, endDate],
    queryFn: async () => {
      return await smallTaskRepository.getByDateRange(userId, startDate, endDate)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId && !!startDate && !!endDate,
  })

  return {
    smallTasks: smallTasksQuery.data || [],
    isLoading: smallTasksQuery.isLoading,
    error: smallTasksQuery.error,
    refetch: smallTasksQuery.refetch,
    loadTasks: smallTasksQuery.refetch, // alias for consistency
  }
}

export function useEmergencyTasks(userId: string) {
  const emergencyTasksQuery = useQuery({
    queryKey: ['small-tasks', 'emergency', userId],
    queryFn: async () => {
      return await smallTaskRepository.getEmergencyTasks(userId)
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!userId,
  })

  return {
    emergencyTasks: emergencyTasksQuery.data || [],
    isLoading: emergencyTasksQuery.isLoading,
    error: emergencyTasksQuery.error,
    refetch: emergencyTasksQuery.refetch,
  }
}

export function useCreateSmallTask(userId: string) {
  const { createSmallTask } = useSmallTasks(userId)
  return { createSmallTask }
}
