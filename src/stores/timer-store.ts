/**
 * TimerStore - Zustand store for timer state management
 * Handles work session timers with offline support
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { WorkSession, SmallTask, Project } from '@/types'

interface TimerState {
  activeSession: WorkSession | null
  currentTask: SmallTask | null
  currentProject: Project | null
  isRunning: boolean
  elapsedTime: number
  startTime: Date | null
  pausedTime: number
  focusLevel: number | null
  moodNotes: string
  isOffline: boolean

  // Actions
  startTimer: (session: WorkSession, task?: SmallTask, project?: Project) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
  resetTimer: () => void

  // Updates
  updateElapsedTime: (elapsed: number) => void
  setFocusLevel: (level: number) => void
  setMoodNotes: (notes: string) => void
  setOfflineStatus: (offline: boolean) => void
  setCurrentTask: (task: SmallTask | null) => void
  setCurrentProject: (project: Project | null) => void

  // Getters
  getFormattedTime: () => string
  getSessionDuration: () => number
  isSessionActive: () => boolean
  canStartNewSession: () => boolean
}

export const useTimerStore = create<TimerState>()(
  devtools(
    (set, get) => ({
      activeSession: null,
      currentTask: null,
      currentProject: null,
      isRunning: false,
      elapsedTime: 0,
      startTime: null,
      pausedTime: 0,
      focusLevel: null,
      moodNotes: '',
      isOffline: false,

      startTimer: (session, task, project) =>
        set({
          activeSession: session,
          currentTask: task || null,
          currentProject: project || null,
          isRunning: true,
          startTime: new Date(session.start_time), // セッションの開始時刻を使用
          elapsedTime: 0,
          pausedTime: 0,
          focusLevel: null,
          moodNotes: '',
        }),

      pauseTimer: () =>
        set(state => ({
          isRunning: false,
          pausedTime: state.elapsedTime,
        })),

      resumeTimer: () =>
        set(state => ({
          isRunning: true,
          startTime: new Date(Date.now() - state.elapsedTime * 1000),
        })),

      stopTimer: () =>
        set({
          activeSession: null,
          isRunning: false,
          elapsedTime: 0,
          startTime: null,
          pausedTime: 0,
          currentTask: null,
          currentProject: null,
        }),

      resetTimer: () =>
        set({
          activeSession: null,
          currentTask: null,
          currentProject: null,
          isRunning: false,
          elapsedTime: 0,
          startTime: null,
          pausedTime: 0,
          focusLevel: null,
          moodNotes: '',
        }),

      updateElapsedTime: elapsed => set({ elapsedTime: elapsed }),

      setFocusLevel: level => set({ focusLevel: level }),

      setMoodNotes: notes => set({ moodNotes: notes }),

      setOfflineStatus: offline => set({ isOffline: offline }),

      setCurrentTask: task => set({ currentTask: task }),

      setCurrentProject: project => set({ currentProject: project }),

      getFormattedTime: () => {
        const { elapsedTime } = get()
        const hours = Math.floor(elapsedTime / 3600)
        const minutes = Math.floor((elapsedTime % 3600) / 60)
        const seconds = elapsedTime % 60

        if (hours > 0) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      },

      getSessionDuration: () => {
        const { elapsedTime, pausedTime } = get()
        return elapsedTime || pausedTime
      },

      isSessionActive: () => {
        const { activeSession } = get()
        return activeSession !== null
      },

      canStartNewSession: () => {
        const { activeSession, isRunning } = get()
        return !activeSession || !isRunning
      },
    }),
    {
      name: 'timer-store',
      serialize: {
        options: {
          map: true,
        },
      },
    }
  )
)
