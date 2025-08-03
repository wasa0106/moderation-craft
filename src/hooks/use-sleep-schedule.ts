/**
 * useSleepSchedule - 睡眠スケジュール管理用カスタムフック
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sleepScheduleRepository } from '@/lib/db/repositories'
import { SyncService } from '@/lib/sync/sync-service'
import { SleepSchedule } from '@/types'
import { format, startOfWeek, addDays } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

const syncService = SyncService.getInstance()

// 特定の起床日の睡眠スケジュールを取得
export function useSleepSchedule(userId: string, dateOfSleep: Date) {
  const dateStr = format(dateOfSleep, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['sleep-schedule', userId, dateStr],
    queryFn: async () => {
      const schedule = await sleepScheduleRepository.getByDateOfSleep(userId, dateStr)
      return schedule || null
    },
  })
}

// 週間の睡眠スケジュールを取得
export function useWeeklySleepSchedules(userId: string, weekDate: Date) {
  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 })
  // 次週の月曜日まで含める（日曜日の睡眠データは月曜日に記録されるため）
  const weekEndPlus = addDays(weekStart, 7) // 次週の月曜日
  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endStr = format(weekEndPlus, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['sleep-schedules', userId, 'week', startStr, endStr],
    queryFn: async () => {
      const schedules = await sleepScheduleRepository.getByDateRange(userId, startStr, endStr)

      // 週の各日に対してスケジュールマップを作成
      const scheduleMap = new Map<string, SleepSchedule>()
      schedules.forEach(schedule => {
        scheduleMap.set(schedule.date_of_sleep, schedule)
      })

      // 週の全日分のデータを生成（存在しない日はnull）
      // 月曜日から次週の月曜日まで（8日分）
      const weekData = []
      for (let i = 0; i <= 7; i++) {
        const date = addDays(weekStart, i)
        const dateStr = format(date, 'yyyy-MM-dd')
        weekData.push({
          date: dateStr,
          dateOfSleep: dateStr,
          schedule: scheduleMap.get(dateStr) || null,
        })
      }

      return weekData
    },
  })
}

// 睡眠スケジュールの作成・更新
export function useSleepScheduleMutation(userId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: async ({
      dateOfSleep,
      data,
    }: {
      dateOfSleep: string
      data: Partial<SleepSchedule>
    }) => {
      const schedule = await sleepScheduleRepository.upsertByDateOfSleep(userId, dateOfSleep, data)

      // 同期キューに追加
      await syncService.addToSyncQueue('sleep_schedule', schedule.id, 'update', schedule)

      return schedule
    },
    onSuccess: (schedule, { dateOfSleep }) => {
      // キャッシュを更新
      queryClient.invalidateQueries({ queryKey: ['sleep-schedule', userId, dateOfSleep] })
      queryClient.invalidateQueries({ queryKey: ['sleep-schedules', userId] })

      toast({
        title: '睡眠予定を保存しました',
        description: `${dateOfSleep}の睡眠予定を更新しました`,
      })
    },
    onError: error => {
      console.error('Failed to save sleep schedule:', error)
      toast({
        title: 'エラー',
        description: '睡眠予定の保存に失敗しました',
        variant: 'destructive',
      })
    },
  })

  return mutation
}

// 複数の睡眠スケジュールを一括更新
export function useBulkSleepScheduleMutation(userId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: async (schedules: Array<{ dateOfSleep: string; data: Partial<SleepSchedule> }>) => {
      const results = await Promise.all(
        schedules.map(async ({ dateOfSleep, data }) => {
          const schedule = await sleepScheduleRepository.upsertByDateOfSleep(
            userId,
            dateOfSleep,
            data
          )

          // 同期キューに追加
          await syncService.addToSyncQueue('sleep_schedule', schedule.id, 'update', schedule)

          return schedule
        })
      )

      return results
    },
    onSuccess: (_, schedules) => {
      // キャッシュを更新
      schedules.forEach(({ dateOfSleep }) => {
        queryClient.invalidateQueries({ queryKey: ['sleep-schedule', userId, dateOfSleep] })
      })
      queryClient.invalidateQueries({ queryKey: ['sleep-schedules', userId] })

      toast({
        title: '週間睡眠予定を保存しました',
        description: `${schedules.length}日分の睡眠予定を更新しました`,
      })
    },
    onError: error => {
      console.error('Failed to save bulk sleep schedules:', error)
      toast({
        title: 'エラー',
        description: '週間睡眠予定の保存に失敗しました',
        variant: 'destructive',
      })
    },
  })

  return mutation
}

// 睡眠スケジュールの削除
export function useDeleteSleepSchedule(userId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      await sleepScheduleRepository.delete(scheduleId)

      // 同期キューに追加
      await syncService.addToSyncQueue('sleep_schedule', scheduleId, 'delete')
    },
    onSuccess: () => {
      // キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['sleep-schedule', userId] })
      queryClient.invalidateQueries({ queryKey: ['sleep-schedules', userId] })

      toast({
        title: '睡眠予定を削除しました',
      })
    },
    onError: error => {
      console.error('Failed to delete sleep schedule:', error)
      toast({
        title: 'エラー',
        description: '睡眠予定の削除に失敗しました',
        variant: 'destructive',
      })
    },
  })

  return mutation
}

// 睡眠ブロックの生成（UI表示用）
export function generateSleepBlocks(schedule: SleepSchedule) {
  const blocks = []

  const startTime = new Date(schedule.scheduled_start_time)
  const endTime = new Date(schedule.scheduled_end_time)

  const startDateStr = format(startTime, 'yyyy-MM-dd')
  const endDateStr = format(endTime, 'yyyy-MM-dd')

  const startHour = startTime.getHours()
  const startMinute = startTime.getMinutes()
  const endHour = endTime.getHours()
  const endMinute = endTime.getMinutes()

  // 同じ日の場合
  if (startDateStr === endDateStr) {
    blocks.push({
      date: startDateStr,
      startHour,
      startMinute,
      endHour,
      endMinute,
      type: 'sleep-single' as const,
      schedule,
    })
  } else {
    // 日を跨ぐ場合
    // 就寝日の夜間部分
    blocks.push({
      date: startDateStr,
      startHour,
      startMinute,
      endHour: 24,
      endMinute: 0,
      type: 'sleep-start' as const,
      schedule,
    })

    // 起床日の早朝部分
    blocks.push({
      date: endDateStr,
      startHour: 0,
      startMinute: 0,
      endHour,
      endMinute,
      type: 'sleep-end' as const,
      schedule,
    })
  }

  return blocks
}

// 睡眠時間のフォーマット
export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}時間${mins}分`
}

// デフォルトの睡眠パターン
export const DEFAULT_SLEEP_PATTERNS = [
  { name: '早寝早起き', bedtime: { hour: 22, minute: 0 }, wakeTime: { hour: 6, minute: 0 } },
  { name: '標準', bedtime: { hour: 23, minute: 0 }, wakeTime: { hour: 7, minute: 0 } },
  { name: '夜型', bedtime: { hour: 1, minute: 0 }, wakeTime: { hour: 9, minute: 0 } },
  { name: '深夜型', bedtime: { hour: 2, minute: 0 }, wakeTime: { hour: 10, minute: 0 } },
]
