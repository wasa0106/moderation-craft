/**
 * TimerStore - Zustand store for timer state management
 * Handles work session timers with offline support
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { WorkSession } from '@/types'

interface TimerState {
  activeSession: WorkSession | null
  isRunning: boolean
  elapsedTime: number
  startTime: Date | null
  pausedTime: number
  focusLevel: number | null
  moodNotes: string
  isOffline: boolean
  
  // Actions
  startTimer: (session: WorkSession) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
  resetTimer: () => void
  
  // Updates
  updateElapsedTime: (elapsed: number) => void
  setFocusLevel: (level: number) => void
  setMoodNotes: (notes: string) => void
  setOfflineStatus: (offline: boolean) => void
  
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
      isRunning: false,
      elapsedTime: 0,
      startTime: null,
      pausedTime: 0,
      focusLevel: null,
      moodNotes: '',
      isOffline: false,
      
      startTimer: (session) =>
        set({
          activeSession: session,
          isRunning: true,
          startTime: new Date(),
          elapsedTime: 0,
          pausedTime: 0,
          focusLevel: null,
          moodNotes: ''
        }),
      
      pauseTimer: () =>
        set((state) => ({
          isRunning: false,
          pausedTime: state.elapsedTime
        })),
      
      resumeTimer: () =>
        set((state) => ({
          isRunning: true,
          startTime: new Date(Date.now() - state.elapsedTime * 1000)
        })),
      
      stopTimer: () =>
        set({
          isRunning: false,
          elapsedTime: 0,
          startTime: null,
          pausedTime: 0
        }),
      
      resetTimer: () =>
        set({
          activeSession: null,
          isRunning: false,
          elapsedTime: 0,
          startTime: null,
          pausedTime: 0,
          focusLevel: null,
          moodNotes: ''
        }),
      
      updateElapsedTime: (elapsed) =>
        set({ elapsedTime: elapsed }),
      
      setFocusLevel: (level) =>
        set({ focusLevel: level }),
      
      setMoodNotes: (notes) =>
        set({ moodNotes: notes }),
      
      setOfflineStatus: (offline) =>
        set({ isOffline: offline }),
      
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
        const { startTime, elapsedTime, pausedTime } = get()
        if (!startTime) return 0
        return Math.floor(elapsedTime / 60) || Math.floor(pausedTime / 60)
      },
      
      isSessionActive: () => {
        const { activeSession } = get()
        return activeSession !== null
      },
      
      canStartNewSession: () => {
        const { activeSession, isRunning } = get()
        return !activeSession || !isRunning
      }
    }),
    {
      name: 'timer-store',
      serialize: {
        options: {
          map: true
        }
      }
    }
  )
)