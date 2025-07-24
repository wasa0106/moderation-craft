/**
 * useSync - Custom hook for sync operations
 * Handles sync queue management and offline status
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { syncQueueRepository } from '@/lib/db/repositories'
import { useSyncStore } from '@/stores/sync-store'
import { SyncService } from '@/lib/sync/sync-service'
import { useOfflineDetector } from '@/lib/sync/offline-detector'
import { queryKeys } from '@/lib/query/query-client'

const syncService = SyncService.getInstance()

export function useSync() {
  const queryClient = useQueryClient()
  const syncStore = useSyncStore()
  const { isOnline, checkConnectivity } = useOfflineDetector()

  // Sync queue query
  const syncQueueQuery = useQuery({
    queryKey: queryKeys.syncQueue(),
    queryFn: async () => {
      const queue = await syncQueueRepository.getAll()
      return queue
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  })

  // Force sync mutation
  const forceSyncMutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        throw new Error('Cannot sync while offline')
      }
      await syncService.forcSync()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.syncQueue() })
      queryClient.invalidateQueries({ queryKey: queryKeys.all })
    },
  })

  // Clear failed items mutation
  const clearFailedItemsMutation = useMutation({
    mutationFn: async () => {
      await syncService.clearFailedItems()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.syncQueue() })
    },
  })

  // Retry failed items mutation
  const retryFailedItemsMutation = useMutation({
    mutationFn: async () => {
      await syncService.retryFailedItems()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.syncQueue() })
    },
  })

  // Toggle auto-sync mutation
  const toggleAutoSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      syncStore.setAutoSync(enabled)
      if (enabled && isOnline) {
        syncService.startAutoSync()
      } else {
        syncService.stopAutoSync()
      }
    },
  })

  // Initialize sync service
  useEffect(() => {
    if (syncStore.autoSyncEnabled && isOnline) {
      syncService.startAutoSync()
    }

    return () => {
      syncService.stopAutoSync()
    }
  }, [syncStore.autoSyncEnabled, isOnline])

  // Handle online/offline transitions
  useEffect(() => {
    if (isOnline && syncStore.autoSyncEnabled && syncStore.needsSync()) {
      syncService.processSyncQueue()
    }
  }, [isOnline, syncStore.autoSyncEnabled])

  return {
    // Sync state
    isOnline,
    isSyncing: syncStore.isSyncing,
    autoSyncEnabled: syncStore.autoSyncEnabled,
    lastSyncTime: syncStore.lastSyncTime,
    syncErrors: syncStore.syncErrors,

    // Queue state
    syncQueue: syncQueueQuery.data || [],
    pendingItemsCount: syncStore.getPendingItemsCount(),
    failedItemsCount: syncStore.getFailedItemsCount(),

    // Actions
    forceSync: forceSyncMutation.mutate,
    clearFailedItems: clearFailedItemsMutation.mutate,
    retryFailedItems: retryFailedItemsMutation.mutate,
    toggleAutoSync: toggleAutoSyncMutation.mutate,
    clearSyncErrors: syncStore.clearSyncErrors,

    // Mutation states
    isForcingSyncing: forceSyncMutation.isPending,
    isClearingFailed: clearFailedItemsMutation.isPending,
    isRetryingFailed: retryFailedItemsMutation.isPending,
    isTogglingAutoSync: toggleAutoSyncMutation.isPending,

    // Utility functions
    needsSync: syncStore.needsSync,
    canSync: syncStore.canSync,
    checkConnectivity,
    getSyncStats: syncService.getSyncStats,

    // Query state
    isLoadingQueue: syncQueueQuery.isLoading,
    queueError: syncQueueQuery.error,
    refetchQueue: syncQueueQuery.refetch,
  }
}

export function useSyncStatus() {
  const syncStore = useSyncStore()

  return {
    isOnline: syncStore.isOnline,
    isSyncing: syncStore.isSyncing,
    pendingItemsCount: syncStore.getPendingItemsCount(),
    failedItemsCount: syncStore.getFailedItemsCount(),
    lastSyncTime: syncStore.lastSyncTime,
    needsSync: syncStore.needsSync(),
    canSync: syncStore.canSync(),
    autoSyncEnabled: syncStore.autoSyncEnabled,
  }
}

export function useSyncErrors() {
  const syncStore = useSyncStore()

  return {
    syncErrors: syncStore.syncErrors,
    clearSyncErrors: syncStore.clearSyncErrors,
    addSyncError: syncStore.addSyncError,
  }
}
