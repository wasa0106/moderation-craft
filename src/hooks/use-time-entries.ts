/**
 * TimeEntry管理用カスタムフック
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TimeEntry } from '@/types'
import { timeEntryRepository } from '@/lib/db/repositories/time-entry-repository'
import { format } from 'date-fns'

/**
 * 指定日のTimeEntryを取得
 */
export function useTimeEntries(userId: string, date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd')
  
  return useQuery({
    queryKey: ['timeEntries', userId, dateStr],
    queryFn: () => timeEntryRepository.getByDate(userId, dateStr),
    staleTime: 1000 * 60 * 5, // 5分間はキャッシュを使用
  })
}

/**
 * 日付範囲でTimeEntryを取得
 */
export function useTimeEntriesByDateRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['timeEntries', userId, 'range', startDate, endDate],
    queryFn: () => timeEntryRepository.getByDateRange(userId, startDate, endDate),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * TimeEntry作成用フック
 */
export function useCreateTimeEntry(userId: string) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>) => {
      return timeEntryRepository.create({
        ...data,
        user_id: userId,
      })
    },
    onSuccess: (newEntry) => {
      // 関連するクエリを無効化
      queryClient.invalidateQueries({ 
        queryKey: ['timeEntries', userId] 
      })
      
      // 特定の日付のキャッシュを更新
      const dateStr = newEntry.date
      queryClient.setQueryData(
        ['timeEntries', userId, dateStr],
        (old: TimeEntry[] = []) => [...old, newEntry]
      )
    },
  })
}

/**
 * TimeEntry更新用フック
 */
export function useUpdateTimeEntry(userId: string) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ 
      id, 
      data 
    }: { 
      id: string
      data: Partial<Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>> 
    }) => {
      return timeEntryRepository.update(id, data)
    },
    onSuccess: (updatedEntry) => {
      if (!updatedEntry) return
      
      // 関連するクエリを無効化
      queryClient.invalidateQueries({ 
        queryKey: ['timeEntries', userId] 
      })
      
      // 特定の日付のキャッシュを更新
      const dateStr = updatedEntry.date
      queryClient.setQueryData(
        ['timeEntries', userId, dateStr],
        (old: TimeEntry[] = []) => 
          old.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry)
      )
    },
  })
}

/**
 * TimeEntry削除用フック
 */
export function useDeleteTimeEntry(userId: string) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => {
      return timeEntryRepository.delete(id)
    },
    onSuccess: (_, deletedId) => {
      // 関連するクエリを無効化
      queryClient.invalidateQueries({ 
        queryKey: ['timeEntries', userId] 
      })
    },
  })
}

/**
 * 日別サマリー取得用フック
 */
export function useTimeEntriesDailySummary(
  userId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['timeEntries', userId, 'dailySummary', startDate, endDate],
    queryFn: () => timeEntryRepository.getDailySummary(userId, startDate, endDate),
    staleTime: 1000 * 60 * 10, // 10分間はキャッシュを使用
  })
}

/**
 * プロジェクト別サマリー取得用フック
 */
export function useTimeEntriesProjectSummary(
  userId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['timeEntries', userId, 'projectSummary', startDate, endDate],
    queryFn: () => timeEntryRepository.getProjectSummary(userId, startDate, endDate),
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * TimeEntryのバッチ作成（ドラッグ&ドロップで複数作成時用）
 */
export function useCreateTimeEntries(userId: string) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (entries: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>[]) => {
      const results = await Promise.all(
        entries.map(entry => 
          timeEntryRepository.create({
            ...entry,
            user_id: userId,
          })
        )
      )
      return results
    },
    onSuccess: () => {
      // 関連するクエリを無効化
      queryClient.invalidateQueries({ 
        queryKey: ['timeEntries', userId] 
      })
    },
  })
}