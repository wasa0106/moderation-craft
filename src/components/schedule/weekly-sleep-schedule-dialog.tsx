'use client'

/**
 * WeeklySleepScheduleDialog - 週間睡眠予定時間入力ダイアログ
 */

import React, { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, subWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Moon, Sun, Clock, AlertCircle, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useWeeklySleepSchedules,
  useBulkSleepScheduleMutation,
  formatSleepDuration,
} from '@/hooks/use-sleep-schedule'
import { SleepSchedule } from '@/types'

interface WeeklySleepScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekStart: Date
  userId: string
}

interface DaySleepSchedule {
  date: Date
  dateStr: string
  bedtimeHour: number
  bedtimeMinute: number
  wakeTimeHour: number
  wakeTimeMinute: number
  duration: number
}

// 睡眠時間をhh:mm形式でフォーマット
const formatSleepDurationHHMM = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}

export function WeeklySleepScheduleDialog({
  open,
  onOpenChange,
  weekStart,
  userId,
}: WeeklySleepScheduleDialogProps) {
  const { data: existingSchedules } = useWeeklySleepSchedules(userId, weekStart)
  const previousWeek = subWeeks(weekStart, 1)
  const { data: previousWeekSchedules } = useWeeklySleepSchedules(userId, previousWeek)
  const mutation = useBulkSleepScheduleMutation(userId)

  // 週の7日分のスケジュールを管理
  const [weekSchedules, setWeekSchedules] = useState<DaySleepSchedule[]>([])

  // 初期値を設定
  useEffect(() => {
    if (!open) return

    const schedules: DaySleepSchedule[] = []
    const weekStartDate = startOfWeek(weekStart, { weekStartsOn: 1 })

    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStartDate, i)
      const dateStr = format(date, 'yyyy-MM-dd')

      // 既存のスケジュールがあれば使用、なければデフォルト値
      const existing = existingSchedules?.find(s => s.dateOfSleep === dateStr)?.schedule

      let bedtimeHour = 23
      let bedtimeMinute = 0
      let wakeTimeHour = 7
      let wakeTimeMinute = 0

      if (existing) {
        const startTime = new Date(existing.scheduled_start_time)
        const endTime = new Date(existing.scheduled_end_time)

        bedtimeHour = startTime.getHours()
        bedtimeMinute = startTime.getMinutes()
        wakeTimeHour = endTime.getHours()
        wakeTimeMinute = endTime.getMinutes()
      }

      schedules.push({
        date,
        dateStr,
        bedtimeHour,
        bedtimeMinute,
        wakeTimeHour,
        wakeTimeMinute,
        duration: calculateDuration(date, bedtimeHour, bedtimeMinute, wakeTimeHour, wakeTimeMinute),
      })
    }

    setWeekSchedules(schedules)
  }, [open, weekStart, existingSchedules])

  // 睡眠時間を計算
  const calculateDuration = (
    date: Date,
    bedtimeHour: number,
    bedtimeMinute: number,
    wakeTimeHour: number,
    wakeTimeMinute: number
  ) => {
    // 起床日の前日を就寝日と仮定
    const sleepDate = addDays(date, -1)

    // 就寝時刻を構築
    let bedtimeDate = new Date(sleepDate)
    bedtimeDate.setHours(bedtimeHour, bedtimeMinute, 0, 0)

    // 起床時刻を構築
    const wakeTimeDate = new Date(date)
    wakeTimeDate.setHours(wakeTimeHour, wakeTimeMinute, 0, 0)

    // 就寝時刻が深夜過ぎ（0-5時）の場合は起床日と同じ日に調整
    if (bedtimeHour < 6) {
      bedtimeDate = new Date(date)
      bedtimeDate.setHours(bedtimeHour, bedtimeMinute, 0, 0)
    }

    // 時間差を計算
    const durationMs = wakeTimeDate.getTime() - bedtimeDate.getTime()
    return Math.round(durationMs / (1000 * 60))
  }

  // スケジュールの更新
  const updateSchedule = (index: number, field: keyof DaySleepSchedule, value: number) => {
    const newSchedules = [...weekSchedules]
    const schedule = { ...newSchedules[index] }

    // フィールドを更新
    ;(schedule as any)[field] = value

    // 睡眠時間を再計算
    schedule.duration = calculateDuration(
      schedule.date,
      schedule.bedtimeHour,
      schedule.bedtimeMinute,
      schedule.wakeTimeHour,
      schedule.wakeTimeMinute
    )

    newSchedules[index] = schedule
    setWeekSchedules(newSchedules)
  }

  // 前週のデータをコピーする処理
  const copyFromPreviousWeek = () => {
    if (!previousWeekSchedules || previousWeekSchedules.length === 0) return

    const newSchedules = weekSchedules.map((schedule, index) => {
      const previousSchedule = previousWeekSchedules[index]?.schedule

      if (previousSchedule) {
        const startTime = new Date(previousSchedule.scheduled_start_time)
        const endTime = new Date(previousSchedule.scheduled_end_time)

        return {
          ...schedule,
          bedtimeHour: startTime.getHours(),
          bedtimeMinute: startTime.getMinutes(),
          wakeTimeHour: endTime.getHours(),
          wakeTimeMinute: endTime.getMinutes(),
          duration: calculateDuration(
            schedule.date,
            startTime.getHours(),
            startTime.getMinutes(),
            endTime.getHours(),
            endTime.getMinutes()
          ),
        }
      }

      return schedule
    })

    setWeekSchedules(newSchedules)
  }

  // 前週にデータがあるかチェック
  const hasPreviousWeekData = previousWeekSchedules?.some(s => s.schedule !== null) || false

  // 保存処理
  const handleSave = async () => {
    try {
      const schedules = weekSchedules.map(schedule => {
        // 起床日の前日を就寝日と仮定
        const sleepDate = addDays(schedule.date, -1)

        // 就寝時刻を構築
        let bedtimeDate = new Date(sleepDate)
        bedtimeDate.setHours(schedule.bedtimeHour, schedule.bedtimeMinute, 0, 0)

        // 起床時刻を構築
        const wakeTimeDate = new Date(schedule.date)
        wakeTimeDate.setHours(schedule.wakeTimeHour, schedule.wakeTimeMinute, 0, 0)

        // 就寝時刻が深夜過ぎ（0-5時）の場合は起床日と同じ日に調整
        if (schedule.bedtimeHour < 6) {
          bedtimeDate = new Date(schedule.date)
          bedtimeDate.setHours(schedule.bedtimeHour, schedule.bedtimeMinute, 0, 0)
        }

        const data: Partial<SleepSchedule> = {
          scheduled_start_time: bedtimeDate.toISOString(),
          scheduled_end_time: wakeTimeDate.toISOString(),
          scheduled_duration_minutes: schedule.duration,
        }

        return {
          dateOfSleep: schedule.dateStr,
          data,
        }
      })

      await mutation.mutateAsync(schedules)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save weekly sleep schedules:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            週間睡眠スケジュール設定
          </DialogTitle>
        </DialogHeader>

        {/* 前週の設定を反映ボタン */}
        {hasPreviousWeekData && (
          <div className="px-6 py-3 border-b border-border">
            <Button
              onClick={copyFromPreviousWeek}
              variant="outline"
              size="sm"
              className="w-full flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              前週の設定を反映
            </Button>
          </div>
        )}

        <div className="py-2 max-h-[60vh] overflow-y-auto">
          {/* ヘッダー行 */}
          <div className="grid grid-cols-[80px_1fr_100px] gap-3 items-center pb-2 px-1 border-b border-border text-xs text-muted-foreground font-medium">
            <div>起床日</div>
            <div className="text-center">就寝時刻 → 起床時刻</div>
            <div className="text-right">睡眠時間</div>
          </div>

          <div className="divide-y divide-border">
            {weekSchedules.map((schedule, index) => (
              <div
                key={schedule.dateStr}
                className="grid grid-cols-[80px_1fr_100px] gap-3 items-center py-2.5 px-1"
              >
                {/* 曜日と日付 */}
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm">
                    {format(schedule.date, 'E', { locale: ja })}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {format(schedule.date, 'M/d')}
                  </span>
                </div>

                {/* 時刻設定 */}
                <div className="flex items-center gap-2 justify-center">
                  <div className="flex items-center gap-1">
                    <Select
                      value={schedule.bedtimeHour.toString()}
                      onValueChange={value =>
                        updateSchedule(index, 'bedtimeHour', parseInt(value, 10))
                      }
                    >
                      <SelectTrigger className="w-16 h-7 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7].map(hour => (
                          <SelectItem key={hour} value={hour.toString()}>
                            {hour.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm">:</span>
                    <Select
                      value={schedule.bedtimeMinute.toString()}
                      onValueChange={value =>
                        updateSchedule(index, 'bedtimeMinute', parseInt(value, 10))
                      }
                    >
                      <SelectTrigger className="w-16 h-7 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map(m => (
                          <SelectItem key={m} value={m.toString()}>
                            {m.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <span className="text-muted-foreground mx-1">→</span>

                  <div className="flex items-center gap-1">
                    <Select
                      value={schedule.wakeTimeHour.toString()}
                      onValueChange={value =>
                        updateSchedule(index, 'wakeTimeHour', parseInt(value, 10))
                      }
                    >
                      <SelectTrigger className="w-16 h-7 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(hour => (
                          <SelectItem key={hour} value={hour.toString()}>
                            {hour.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm">:</span>
                    <Select
                      value={schedule.wakeTimeMinute.toString()}
                      onValueChange={value =>
                        updateSchedule(index, 'wakeTimeMinute', parseInt(value, 10))
                      }
                    >
                      <SelectTrigger className="w-16 h-7 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map(m => (
                          <SelectItem key={m} value={m.toString()}>
                            {m.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 睡眠時間 */}
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      schedule.duration < 360 && 'text-destructive',
                      schedule.duration > 600 && 'text-destructive'
                    )}
                  >
                    {schedule.duration > 0 ? formatSleepDurationHHMM(schedule.duration) : 'エラー'}
                  </span>
                  {(schedule.duration < 360 || schedule.duration > 600) &&
                    schedule.duration > 0 && <AlertCircle className="h-3 w-3 text-destructive" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || weekSchedules.some(s => s.duration <= 0)}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
