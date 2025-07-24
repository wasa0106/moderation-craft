/**
 * useTasks - Custom hook for task operations with optimistic updates
 * Handles BigTask and SmallTask CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bigTaskRepository, smallTaskRepository } from '@/lib/db/repositories'
import { useTaskStore } from '@/stores/task-store'
import { SyncService } from '@/lib/sync/sync-service'
import { queryKeys, invalidateQueries } from '@/lib/query/query-client'
import {
  BigTask,
  SmallTask,
  CreateBigTaskData,
  CreateSmallTaskData,
  UpdateBigTaskData,
  UpdateSmallTaskData,
} from '@/types'
import { generateId } from '@/lib/utils'

const syncService = SyncService.getInstance()

export function useBigTasks(projectId: string) {
  const queryClient = useQueryClient()
  const taskStore = useTaskStore()

  const bigTasksQuery = useQuery({
    queryKey: queryKeys.bigTasksByProject(projectId),
    queryFn: async () => {
      const tasks = await bigTaskRepository.getByProjectId(projectId)
      taskStore.setBigTasks(tasks)
      return tasks
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!projectId,
  })

  const createBigTaskMutation = useMutation({
    mutationFn: async (data: CreateBigTaskData) => {
      const createdTask = await bigTaskRepository.create(data)
      await syncService.addToSyncQueue('big_task', createdTask.id, 'create', createdTask)
      return createdTask
    },
    onSuccess: () => {
      invalidateQueries.bigTasksByProject(projectId)
      invalidateQueries.bigTasks()
    },
  })

  const updateBigTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateBigTaskData }) => {
      const originalTask = taskStore.getBigTaskById(id)
      if (!originalTask) {
        throw new Error('Task not found')
      }

      const updatedTask = {
        ...originalTask,
        ...data,
        updated_at: new Date().toISOString(),
      }

      taskStore.optimisticUpdateBigTask(id, updatedTask)

      try {
        const result = await bigTaskRepository.update(id, data)
        await syncService.addToSyncQueue('big_task', id, 'update', result)
        return result
      } catch (error) {
        taskStore.revertOptimisticUpdateBigTask(id, originalTask)
        throw error
      }
    },
    onSuccess: task => {
      invalidateQueries.bigTask(task.id)
      invalidateQueries.bigTasksByProject(projectId)
    },
  })

  const deleteBigTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const originalTask = taskStore.getBigTaskById(id)
      if (!originalTask) {
        throw new Error('Task not found')
      }

      taskStore.optimisticDeleteBigTask(id)

      try {
        await bigTaskRepository.delete(id)
        await syncService.addToSyncQueue('big_task', id, 'delete')
      } catch (error) {
        taskStore.revertOptimisticDeleteBigTask(originalTask)
        throw error
      }
    },
    onSuccess: () => {
      invalidateQueries.bigTasksByProject(projectId)
    },
  })

  return {
    bigTasks: bigTasksQuery.data || [],
    isLoading: bigTasksQuery.isLoading,
    error: bigTasksQuery.error,

    createBigTask: createBigTaskMutation.mutate,
    updateBigTask: updateBigTaskMutation.mutate,
    deleteBigTask: deleteBigTaskMutation.mutate,

    isCreating: createBigTaskMutation.isPending,
    isUpdating: updateBigTaskMutation.isPending,
    isDeleting: deleteBigTaskMutation.isPending,

    refetch: bigTasksQuery.refetch,
  }
}

export function useSmallTasks(bigTaskId?: string, userId?: string, date?: string) {
  const queryClient = useQueryClient()
  const taskStore = useTaskStore()

  const smallTasksQuery = useQuery({
    queryKey: bigTaskId
      ? queryKeys.smallTasksByBigTask(bigTaskId)
      : date && userId
        ? queryKeys.smallTasksByDate(userId, date)
        : queryKeys.smallTasks(),
    queryFn: async () => {
      let tasks: SmallTask[]

      if (bigTaskId) {
        tasks = await smallTaskRepository.getByBigTaskId(bigTaskId)
      } else if (date && userId) {
        tasks = await smallTaskRepository.getScheduledForDate(userId, date)
      } else {
        tasks = []
      }

      taskStore.setSmallTasks(tasks)
      return tasks
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!(bigTaskId || (date && userId)),
  })

  const createSmallTaskMutation = useMutation({
    mutationFn: async (data: CreateSmallTaskData) => {
      const createdTask = await smallTaskRepository.create(data)
      await syncService.addToSyncQueue('small_task', createdTask.id, 'create', createdTask)
      return createdTask
    },
    onSuccess: () => {
      if (bigTaskId) {
        invalidateQueries.smallTasksByBigTask(bigTaskId)
      }
      if (date && userId) {
        invalidateQueries.smallTasksByDate(userId, date)
      }
      invalidateQueries.smallTasks()
    },
  })

  const updateSmallTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSmallTaskData }) => {
      const originalTask = taskStore.getSmallTaskById(id)
      if (!originalTask) {
        throw new Error('Task not found')
      }

      const updatedTask = {
        ...originalTask,
        ...data,
        updated_at: new Date().toISOString(),
      }

      taskStore.optimisticUpdateSmallTask(id, updatedTask)

      try {
        const result = await smallTaskRepository.update(id, data)
        await syncService.addToSyncQueue('small_task', id, 'update', result)
        return result
      } catch (error) {
        taskStore.revertOptimisticUpdateSmallTask(id, originalTask)
        throw error
      }
    },
    onSuccess: task => {
      invalidateQueries.smallTask(task.id)
      if (bigTaskId) {
        invalidateQueries.smallTasksByBigTask(bigTaskId)
      }
      if (date && userId) {
        invalidateQueries.smallTasksByDate(userId, date)
      }
    },
  })

  const deleteSmallTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const originalTask = taskStore.getSmallTaskById(id)
      if (!originalTask) {
        throw new Error('Task not found')
      }

      taskStore.optimisticDeleteSmallTask(id)

      try {
        await smallTaskRepository.delete(id)
        await syncService.addToSyncQueue('small_task', id, 'delete')
      } catch (error) {
        taskStore.revertOptimisticDeleteSmallTask(originalTask)
        throw error
      }
    },
    onSuccess: () => {
      if (bigTaskId) {
        invalidateQueries.smallTasksByBigTask(bigTaskId)
      }
      if (date && userId) {
        invalidateQueries.smallTasksByDate(userId, date)
      }
    },
  })

  const startTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const task = await smallTaskRepository.startTask(id)
      taskStore.setActiveTask(id)
      await syncService.addToSyncQueue('small_task', id, 'update', task)
      return task
    },
    onSuccess: task => {
      invalidateQueries.smallTask(task.id)
      if (userId) {
        invalidateQueries.activeTasks(userId)
      }
    },
  })

  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, focusLevel }: { id: string; focusLevel?: number }) => {
      const task = await smallTaskRepository.completeTask(id, undefined, focusLevel)
      if (taskStore.activeTaskId === id) {
        taskStore.setActiveTask(null)
      }
      await syncService.addToSyncQueue('small_task', id, 'update', task)
      return task
    },
    onSuccess: task => {
      invalidateQueries.smallTask(task.id)
      if (userId) {
        invalidateQueries.activeTasks(userId)
      }
    },
  })

  return {
    smallTasks: smallTasksQuery.data || [],
    isLoading: smallTasksQuery.isLoading,
    error: smallTasksQuery.error,

    createSmallTask: createSmallTaskMutation.mutate,
    updateSmallTask: updateSmallTaskMutation.mutate,
    deleteSmallTask: deleteSmallTaskMutation.mutate,
    startTask: startTaskMutation.mutate,
    completeTask: completeTaskMutation.mutate,

    isCreating: createSmallTaskMutation.isPending,
    isUpdating: updateSmallTaskMutation.isPending,
    isDeleting: deleteSmallTaskMutation.isPending,
    isStarting: startTaskMutation.isPending,
    isCompleting: completeTaskMutation.isPending,

    refetch: smallTasksQuery.refetch,
  }
}

export function useTasksForDate(userId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.smallTasksByDate(userId, date),
    queryFn: () => smallTaskRepository.getScheduledForDate(userId, date),
    staleTime: 2 * 60 * 1000,
    enabled: !!(userId && date),
  })
}

export function useActiveTasks(userId: string) {
  const taskStore = useTaskStore()

  return useQuery({
    queryKey: queryKeys.activeTasks(userId),
    queryFn: async () => {
      const tasks = await smallTaskRepository.getActiveTasks(userId)
      return tasks
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!userId,
  })
}
