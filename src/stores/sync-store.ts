/**
 * SyncStore - Zustand store for synchronization state management
 * Handles sync queue, offline status, and sync operations
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { SyncQueueItem } from '@/types'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  syncQueue: SyncQueueItem[]
  lastSyncTime: string | null
  syncErrors: string[]
  autoSyncEnabled: boolean

  // Pull sync state
  lastPullTime: string | null
  isPulling: boolean

  // Actions
  setOnlineStatus: (online: boolean) => void
  setSyncStatus: (syncing: boolean) => void
  setLastSyncTime: (time: string) => void
  setAutoSync: (enabled: boolean) => void
  setLastPullTime: (time: string) => void
  setPullStatus: (pulling: boolean) => void

  // Queue management
  addToSyncQueue: (item: SyncQueueItem) => void
  removeFromSyncQueue: (itemId: string) => void
  clearSyncQueue: () => void
  updateSyncQueueItem: (itemId: string, updates: Partial<SyncQueueItem>) => void

  // Error handling
  addSyncError: (error: string) => void
  clearSyncErrors: () => void

  // Getters
  getPendingItemsCount: () => number
  getFailedItemsCount: () => number
  getQueueByStatus: (status: SyncQueueItem['status']) => SyncQueueItem[]
  getQueueByEntityType: (entityType: string) => SyncQueueItem[]
  needsSync: () => boolean
  canSync: () => boolean
}

export const useSyncStore = create<SyncState>()(
  devtools(
    (set, get) => ({
      isOnline: true,
      isSyncing: false,
      syncQueue: [],
      lastSyncTime: null,
      syncErrors: [],
      autoSyncEnabled: false,
      lastPullTime: null,
      isPulling: false,

      setOnlineStatus: online => set({ isOnline: online }),

      setSyncStatus: syncing => set({ isSyncing: syncing }),

      setLastSyncTime: time => set({ lastSyncTime: time }),

      setAutoSync: enabled => set({ autoSyncEnabled: enabled }),

      setLastPullTime: time => set({ lastPullTime: time }),

      setPullStatus: pulling => set({ isPulling: pulling }),

      addToSyncQueue: item =>
        set(state => ({
          syncQueue: [...state.syncQueue, item],
        })),

      removeFromSyncQueue: itemId =>
        set(state => ({
          syncQueue: state.syncQueue.filter(item => item.id !== itemId),
        })),

      clearSyncQueue: () => set({ syncQueue: [] }),

      updateSyncQueueItem: (itemId, updates) =>
        set(state => ({
          syncQueue: state.syncQueue.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        })),

      addSyncError: error =>
        set(state => ({
          syncErrors: [...state.syncErrors, error],
        })),

      clearSyncErrors: () => set({ syncErrors: [] }),

      getPendingItemsCount: () => {
        const { syncQueue } = get()
        return syncQueue.filter(item => item.status === 'pending').length
      },

      getFailedItemsCount: () => {
        const { syncQueue } = get()
        return syncQueue.filter(item => item.status === 'failed').length
      },

      getQueueByStatus: status => {
        const { syncQueue } = get()
        return syncQueue.filter(item => item.status === status)
      },

      getQueueByEntityType: entityType => {
        const { syncQueue } = get()
        return syncQueue.filter(item => item.entity_type === entityType)
      },

      needsSync: () => {
        const { syncQueue } = get()
        return syncQueue.some(item => item.status === 'pending')
      },

      canSync: () => {
        const { isOnline, isSyncing } = get()
        return isOnline && !isSyncing
      },
    }),
    {
      name: 'sync-store',
      serialize: {
        options: {
          map: true,
        },
      },
    }
  )
)
