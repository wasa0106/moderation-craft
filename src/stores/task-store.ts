/**
 * TaskStore - Zustand store for task state management
 * Handles BigTask and SmallTask state with optimistic updates
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { BigTask, SmallTask, CreateBigTaskData, CreateSmallTaskData } from '@/types'

interface TaskState {
  bigTasks: BigTask[]
  smallTasks: SmallTask[]
  activeTaskId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setBigTasks: (tasks: BigTask[]) => void
  setSmallTasks: (tasks: SmallTask[]) => void
  setActiveTask: (taskId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Optimistic updates - BigTask
  optimisticCreateBigTask: (task: BigTask) => void
  optimisticUpdateBigTask: (taskId: string, updates: Partial<BigTask>) => void
  optimisticDeleteBigTask: (taskId: string) => void

  // Optimistic updates - SmallTask
  optimisticCreateSmallTask: (task: SmallTask) => void
  optimisticUpdateSmallTask: (taskId: string, updates: Partial<SmallTask>) => void
  optimisticDeleteSmallTask: (taskId: string) => void

  // Revert optimistic updates
  revertOptimisticCreateBigTask: (taskId: string) => void
  revertOptimisticUpdateBigTask: (taskId: string, originalTask: BigTask) => void
  revertOptimisticDeleteBigTask: (task: BigTask) => void

  revertOptimisticCreateSmallTask: (taskId: string) => void
  revertOptimisticUpdateSmallTask: (taskId: string, originalTask: SmallTask) => void
  revertOptimisticDeleteSmallTask: (task: SmallTask) => void

  // Selectors
  getActiveTask: () => SmallTask | null
  getBigTaskById: (id: string) => BigTask | null
  getSmallTaskById: (id: string) => SmallTask | null
  getBigTasksByProject: (projectId: string) => BigTask[]
  getSmallTasksByBigTask: (bigTaskId: string) => SmallTask[]
  getScheduledTasksForDate: (date: string) => SmallTask[]
  getActiveTasks: () => SmallTask[]
  getCompletedTasks: () => SmallTask[]
  getOverdueTasks: () => SmallTask[]
  getEmergencyTasks: () => SmallTask[]
}

export const useTaskStore = create<TaskState>()(
  devtools(
    (set, get) => ({
      bigTasks: [],
      smallTasks: [],
      activeTaskId: null,
      isLoading: false,
      error: null,

      setBigTasks: tasks => set({ bigTasks: tasks }),
      setSmallTasks: tasks => set({ smallTasks: tasks }),
      setActiveTask: taskId => set({ activeTaskId: taskId }),
      setLoading: loading => set({ isLoading: loading }),
      setError: error => set({ error }),

      optimisticCreateBigTask: task =>
        set(state => ({
          bigTasks: [...state.bigTasks, task],
          error: null,
        })),

      optimisticUpdateBigTask: (taskId, updates) =>
        set(state => ({
          bigTasks: state.bigTasks.map(t => (t.id === taskId ? { ...t, ...updates } : t)),
          error: null,
        })),

      optimisticDeleteBigTask: taskId =>
        set(state => ({
          bigTasks: state.bigTasks.filter(t => t.id !== taskId),
          smallTasks: state.smallTasks.filter(t => t.big_task_id !== taskId),
          error: null,
        })),

      optimisticCreateSmallTask: task =>
        set(state => ({
          smallTasks: [...state.smallTasks, task],
          error: null,
        })),

      optimisticUpdateSmallTask: (taskId, updates) =>
        set(state => ({
          smallTasks: state.smallTasks.map(t => (t.id === taskId ? { ...t, ...updates } : t)),
          error: null,
        })),

      optimisticDeleteSmallTask: taskId =>
        set(state => ({
          smallTasks: state.smallTasks.filter(t => t.id !== taskId),
          activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
          error: null,
        })),

      revertOptimisticCreateBigTask: taskId =>
        set(state => ({
          bigTasks: state.bigTasks.filter(t => t.id !== taskId),
        })),

      revertOptimisticUpdateBigTask: (taskId, originalTask) =>
        set(state => ({
          bigTasks: state.bigTasks.map(t => (t.id === taskId ? originalTask : t)),
        })),

      revertOptimisticDeleteBigTask: task =>
        set(state => ({
          bigTasks: [...state.bigTasks, task],
        })),

      revertOptimisticCreateSmallTask: taskId =>
        set(state => ({
          smallTasks: state.smallTasks.filter(t => t.id !== taskId),
        })),

      revertOptimisticUpdateSmallTask: (taskId, originalTask) =>
        set(state => ({
          smallTasks: state.smallTasks.map(t => (t.id === taskId ? originalTask : t)),
        })),

      revertOptimisticDeleteSmallTask: task =>
        set(state => ({
          smallTasks: [...state.smallTasks, task],
        })),

      getActiveTask: () => {
        const { smallTasks, activeTaskId } = get()
        return activeTaskId ? smallTasks.find(t => t.id === activeTaskId) || null : null
      },

      getBigTaskById: id => {
        const { bigTasks } = get()
        return bigTasks.find(t => t.id === id) || null
      },

      getSmallTaskById: id => {
        const { smallTasks } = get()
        return smallTasks.find(t => t.id === id) || null
      },

      getBigTasksByProject: projectId => {
        const { bigTasks } = get()
        return bigTasks.filter(t => t.project_id === projectId)
      },

      getSmallTasksByBigTask: bigTaskId => {
        const { smallTasks } = get()
        return smallTasks.filter(t => t.big_task_id === bigTaskId)
      },

      getScheduledTasksForDate: date => {
        const { smallTasks } = get()
        const startOfDay = `${date}T00:00:00.000Z`
        const endOfDay = `${date}T23:59:59.999Z`
        return smallTasks.filter(
          t => t.scheduled_start >= startOfDay && t.scheduled_start <= endOfDay
        )
      },

      getActiveTasks: () => {
        const { smallTasks } = get()
        return smallTasks.filter(t => t.actual_start && !t.actual_end)
      },

      getCompletedTasks: () => {
        const { smallTasks } = get()
        return smallTasks.filter(t => t.actual_end)
      },

      getOverdueTasks: () => {
        const { smallTasks } = get()
        const now = new Date().toISOString()
        return smallTasks.filter(t => t.scheduled_end < now && !t.actual_end)
      },

      getEmergencyTasks: () => {
        const { smallTasks } = get()
        return smallTasks.filter(t => t.is_emergency)
      },
    }),
    {
      name: 'task-store',
      serialize: {
        options: {
          map: true,
        },
      },
    }
  )
)
