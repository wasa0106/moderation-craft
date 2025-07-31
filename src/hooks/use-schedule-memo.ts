/**
 * useScheduleMemo - Custom hook for schedule memo operations
 * Handles weekly schedule memo CRUD operations with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleMemoRepository } from '@/lib/db/repositories'
import { SyncService } from '@/lib/sync/sync-service'
import { queryKeys } from '@/lib/query/query-client'
import { ScheduleMemo } from '@/types'
import { useCallback } from 'react'
import { startOfWeek } from 'date-fns'
import { db } from '@/lib/db/database'

const syncService = SyncService.getInstance()

export function useScheduleMemo(userId: string, currentWeek: Date) {
  const queryClient = useQueryClient()
  
  // Calculate week start date in YYYY-MM-DD format
  const weekStartDate = startOfWeek(currentWeek, { weekStartsOn: 1 })
    .toISOString()
    .split('T')[0]

  // Fetch schedule memo for the current week
  const scheduleMemoQuery = useQuery({
    queryKey: ['scheduleMemo', userId, weekStartDate],
    queryFn: async () => {
      try {
        const memo = await scheduleMemoRepository.getByWeek(userId, weekStartDate)
        return memo || null
      } catch (error) {
        console.error('Failed to fetch schedule memo:', error)
        
        // Handle database errors
        if (
          error instanceof Error &&
          (error.message.includes('UpgradeError') ||
            error.message.includes('DatabaseClosedError'))
        ) {
          await db.handleSchemaError()
          // Retry after recovery
          const memo = await scheduleMemoRepository.getByWeek(userId, weekStartDate)
          return memo || null
        }
        
        throw error
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
  })

  // Save/update schedule memo mutation
  const saveScheduleMemoMutation = useMutation({
    mutationFn: async (content: string) => {
      const memo = await scheduleMemoRepository.upsertByWeek(userId, weekStartDate, content)
      await syncService.addToSyncQueue('schedule_memo', memo.id, 
        scheduleMemoQuery.data ? 'update' : 'create', memo)
      return memo
    },
    onSuccess: (memo) => {
      queryClient.setQueryData(['scheduleMemo', userId, weekStartDate], memo)
    },
    onError: (error) => {
      console.error('Failed to save schedule memo:', error)
    },
  })

  // Direct save function (no debounce)
  const save = useCallback((content: string) => {
    saveScheduleMemoMutation.mutate(content)
  }, [saveScheduleMemoMutation])

  // Get recent memos
  const getRecentMemos = useCallback(async (limit?: number) => {
    try {
      return await scheduleMemoRepository.getRecent(userId, limit)
    } catch (error) {
      console.error('Failed to get recent memos:', error)
      return []
    }
  }, [userId])

  // Search memos
  const searchMemos = useCallback(async (query: string) => {
    try {
      return await scheduleMemoRepository.searchByContent(userId, query)
    } catch (error) {
      console.error('Failed to search memos:', error)
      return []
    }
  }, [userId])

  return {
    memo: scheduleMemoQuery.data,
    content: scheduleMemoQuery.data?.content || '',
    isLoading: scheduleMemoQuery.isLoading,
    isSaving: saveScheduleMemoMutation.isPending,
    error: scheduleMemoQuery.error || saveScheduleMemoMutation.error,
    save,
    getRecentMemos,
    searchMemos,
  }
}