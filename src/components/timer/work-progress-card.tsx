/**
 * WorkProgressCard - 今日の作業予定と実績を表示するカード
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { SmallTask, WorkSession } from '@/types'
import { useTodayTotal } from '@/hooks/use-today-total'
import { isToday } from 'date-fns'

interface WorkProgressCardProps {
  dayTasks: SmallTask[]
  todaySessions: WorkSession[]
  weeklyTotal?: string
  selectedDate?: Date
}

export function WorkProgressCard({ dayTasks, todaySessions, weeklyTotal, selectedDate }: WorkProgressCardProps) {
  // 予定時間の計算（分単位）
  const plannedMinutes = dayTasks.reduce((sum, task) => sum + task.estimated_minutes, 0)
  
  // 今日の実績時間（リアルタイム更新）
  const { todayTotalFormatted } = useTodayTotal('current-user', todaySessions)
  
  // 選択日が今日かどうか
  const isTodaySelected = selectedDate ? isToday(selectedDate) : true
  
  // 実績時間の計算（分単位、今日以外の日付用）
  const actualSeconds = todaySessions.reduce((sum, session) => sum + session.duration_seconds, 0)
  const actualMinutes = Math.floor(actualSeconds / 60)
  
  // 分をhh:mm形式にフォーマット（予定時間用）
  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)
    
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`
  }
  
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex justify-around items-center">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">
              {isTodaySelected ? '今日の実績 / 予定' : '実績 / 予定'}
            </div>
            <div className="text-lg font-medium font-mono">
              {isTodaySelected ? todayTotalFormatted : formatTime(actualMinutes)} / {formatTime(plannedMinutes)}:00
            </div>
          </div>
          {weeklyTotal && (
            <div className="border-l pl-6">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">今週の合計</div>
                <div className="text-lg font-medium font-mono">
                  {weeklyTotal}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}