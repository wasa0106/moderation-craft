/**
 * QueryClient - TanStack Query configuration
 * Handles client-side caching and synchronization
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false
        }
        return failureCount < 3
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false
        }
        return failureCount < 2
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst',
    },
  },
})

// Query keys factory
export const queryKeys = {
  all: ['moderation-craft'] as const,

  projects: () => [...queryKeys.all, 'projects'] as const,
  project: (id: string) => [...queryKeys.projects(), id] as const,
  projectsByUser: (userId: string) => [...queryKeys.projects(), 'user', userId] as const,
  activeProjects: (userId: string) => [...queryKeys.projects(), 'active', userId] as const,

  bigTasks: () => [...queryKeys.all, 'big-tasks'] as const,
  bigTask: (id: string) => [...queryKeys.bigTasks(), id] as const,
  bigTasksByUser: (userId: string) => [...queryKeys.bigTasks(), 'user', userId] as const,
  bigTasksByProject: (projectId: string) =>
    [...queryKeys.bigTasks(), 'project', projectId] as const,

  smallTasks: () => [...queryKeys.all, 'small-tasks'] as const,
  smallTask: (id: string) => [...queryKeys.smallTasks(), id] as const,
  smallTasksByBigTask: (bigTaskId: string) =>
    [...queryKeys.smallTasks(), 'big-task', bigTaskId] as const,
  smallTasksByDate: (userId: string, date: string) =>
    [...queryKeys.smallTasks(), 'user', userId, 'date', date] as const,
  activeTasks: (userId: string) => [...queryKeys.smallTasks(), 'active', userId] as const,
  activeTasksForUser: (userId: string) => [...queryKeys.smallTasks(), 'active', userId] as const,

  workSessions: () => [...queryKeys.all, 'work-sessions'] as const,
  workSession: (id: string) => [...queryKeys.workSessions(), id] as const,
  workSessionsByTask: (taskId: string) => [...queryKeys.workSessions(), 'task', taskId] as const,
  workSessionsByDate: (userId: string, date: string) =>
    [...queryKeys.workSessions(), 'user', userId, 'date', date] as const,
  activeSession: (userId: string) => [...queryKeys.workSessions(), 'active', userId] as const,
  activeSessionForUser: (userId: string) =>
    [...queryKeys.workSessions(), 'active', userId] as const,

  moodEntries: () => [...queryKeys.all, 'mood-entries'] as const,
  moodEntry: (id: string) => [...queryKeys.moodEntries(), id] as const,
  moodEntriesByDate: (userId: string, date: string) =>
    [...queryKeys.moodEntries(), 'user', userId, 'date', date] as const,

  dailyConditions: () => [...queryKeys.all, 'daily-conditions'] as const,
  dailyCondition: (id: string) => [...queryKeys.dailyConditions(), id] as const,
  dailyConditionsByDate: (userId: string, date: string) =>
    [...queryKeys.dailyConditions(), 'user', userId, 'date', date] as const,

  sync: () => [...queryKeys.all, 'sync'] as const,
  syncQueue: () => [...queryKeys.sync(), 'queue'] as const,
  syncStatus: () => [...queryKeys.sync(), 'status'] as const,
} as const

// Utility functions
export const invalidateQueries = {
  projects: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
  project: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.project(id) }),
  projectsByUser: (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projectsByUser(userId) }),

  bigTasks: () => queryClient.invalidateQueries({ queryKey: queryKeys.bigTasks() }),
  bigTask: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.bigTask(id) }),
  bigTasksByUser: (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bigTasksByUser(userId) }),
  bigTasksByProject: (projectId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bigTasksByProject(projectId) }),

  smallTasks: () => queryClient.invalidateQueries({ queryKey: queryKeys.smallTasks() }),
  smallTask: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.smallTask(id) }),
  smallTasksByBigTask: (bigTaskId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.smallTasksByBigTask(bigTaskId) }),
  smallTasksByDate: (userId: string, date: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.smallTasksByDate(userId, date) }),
  activeTasks: (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.activeTasks(userId) }),

  workSessions: () => queryClient.invalidateQueries({ queryKey: queryKeys.workSessions() }),
  workSession: (id: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workSession(id) }),
  workSessionsByTask: (taskId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workSessionsByTask(taskId) }),
  activeSession: (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.activeSession(userId) }),

  all: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
}
