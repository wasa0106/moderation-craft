/**
 * useBigTasks - Big tasks management hook
 * Provides CRUD operations for big tasks with optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bigTaskRepository } from '@/lib/db/repositories'
import { SyncService } from '@/lib/sync/sync-service'
import { queryKeys, invalidateQueries } from '@/lib/query/query-client'
import { BigTask, CreateBigTaskData, UpdateBigTaskData } from '@/types'
import { db } from '@/lib/db/database'

const syncService = SyncService.getInstance()

export function useBigTasks(userId: string, projectId?: string) {
  const queryClient = useQueryClient()

  // Fetch big tasks query
  const bigTasksQuery = useQuery({
    queryKey: projectId ? queryKeys.bigTasksByProject(projectId) : queryKeys.bigTasksByUser(userId),
    queryFn: async () => {
      try {
        if (projectId) {
          return await bigTaskRepository.getByProjectId(projectId)
        } else {
          return await bigTaskRepository.getTasksByUser(userId)
        }
      } catch (error) {
        console.error('Failed to get big tasks:', error)

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
            if (projectId) {
              return await bigTaskRepository.getByProjectId(projectId)
            } else {
              return await bigTaskRepository.getTasksByUser(userId)
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

  // Create big task mutation
  const createBigTaskMutation = useMutation({
    mutationFn: async (data: CreateBigTaskData) => {
      const createdBigTask = await bigTaskRepository.create(data)
      await syncService.addToSyncQueue('big_task', createdBigTask.id, 'create', createdBigTask)
      return createdBigTask
    },
    onSuccess: bigTask => {
      if (projectId) {
        invalidateQueries.bigTasksByProject(projectId)
      }
      invalidateQueries.bigTasksByUser(userId)
    },
    onError: error => {
      console.error('Failed to create big task:', error)
    },
  })

  // Update big task mutation
  const updateBigTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateBigTaskData }) => {
      const result = await bigTaskRepository.update(id, data)
      await syncService.addToSyncQueue('big_task', id, 'update', result)
      return result
    },
    onSuccess: bigTask => {
      invalidateQueries.bigTask(bigTask.id)
      if (projectId) {
        invalidateQueries.bigTasksByProject(projectId)
      }
      invalidateQueries.bigTasksByUser(userId)
    },
    onError: error => {
      console.error('Failed to update big task:', error)
    },
  })

  // Delete big task mutation
  const deleteBigTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await bigTaskRepository.delete(id)
      await syncService.addToSyncQueue('big_task', id, 'delete')
    },
    onSuccess: (_, deletedId) => {
      invalidateQueries.bigTask(deletedId)
      if (projectId) {
        invalidateQueries.bigTasksByProject(projectId)
      }
      invalidateQueries.bigTasksByUser(userId)
    },
    onError: error => {
      console.error('Failed to delete big task:', error)
    },
  })

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BigTask['status'] }) => {
      const result = await bigTaskRepository.updateTaskStatus(id, status)
      await syncService.addToSyncQueue('big_task', id, 'update', result)
      return result
    },
    onSuccess: bigTask => {
      invalidateQueries.bigTask(bigTask.id)
      if (projectId) {
        invalidateQueries.bigTasksByProject(projectId)
      }
      invalidateQueries.bigTasksByUser(userId)
    },
  })

  // Update actual hours mutation
  const updateActualHoursMutation = useMutation({
    mutationFn: async ({ id, actualHours }: { id: string; actualHours: number }) => {
      const result = await bigTaskRepository.updateActualHours(id, actualHours)
      await syncService.addToSyncQueue('big_task', id, 'update', result)
      return result
    },
    onSuccess: bigTask => {
      invalidateQueries.bigTask(bigTask.id)
      if (projectId) {
        invalidateQueries.bigTasksByProject(projectId)
      }
      invalidateQueries.bigTasksByUser(userId)
    },
  })

  return {
    // Query state
    bigTasks: bigTasksQuery.data || [],
    isLoading: bigTasksQuery.isLoading,
    error: bigTasksQuery.error,

    // Mutations
    createBigTask: createBigTaskMutation.mutateAsync,
    updateBigTask: updateBigTaskMutation.mutateAsync,
    deleteBigTask: deleteBigTaskMutation.mutateAsync,
    updateTaskStatus: updateTaskStatusMutation.mutateAsync,
    updateActualHours: updateActualHoursMutation.mutateAsync,

    // Mutation states
    isCreating: createBigTaskMutation.isPending,
    isUpdating: updateBigTaskMutation.isPending,
    isDeleting: deleteBigTaskMutation.isPending,

    // Refresh data
    refetch: bigTasksQuery.refetch,
  }
}

export function useBigTask(bigTaskId: string) {
  const bigTaskQuery = useQuery({
    queryKey: queryKeys.bigTask(bigTaskId),
    queryFn: async () => {
      const bigTask = await bigTaskRepository.getById(bigTaskId)
      return bigTask
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!bigTaskId,
  })

  return {
    bigTask: bigTaskQuery.data,
    isLoading: bigTaskQuery.isLoading,
    error: bigTaskQuery.error,
    refetch: bigTaskQuery.refetch,
  }
}


export function useBigTasksByDateRange(userId: string, startDate: string, endDate: string) {
  const bigTasksQuery = useQuery({
    queryKey: ['bigTasks', 'dateRange', userId, startDate, endDate],
    queryFn: async () => {
      return await bigTaskRepository.getByDateRange(userId, startDate, endDate)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId && !!startDate && !!endDate,
  })

  return {
    bigTasks: bigTasksQuery.data || [],
    isLoading: bigTasksQuery.isLoading,
    error: bigTasksQuery.error,
    refetch: bigTasksQuery.refetch,
  }
}

export function useCreateBigTask(userId: string) {
  const { createBigTask } = useBigTasks(userId)
  return { createBigTask }
}
