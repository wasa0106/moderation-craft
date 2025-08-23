/**
 * RecurringWorkTable - 定期作業の入力・管理テーブル
 * 定期的に発生する作業（定例MTG、ルーティンタスク等）の設定
 */

'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Trash2,
  Plus,
  Calendar,
  Clock,
  AlertCircle,
  Settings,
} from 'lucide-react'
import { RecurringWork } from '@/types'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'

interface RecurringWorkTableProps {
  recurringWorks: RecurringWork[]
  onAddWork: (work: Omit<RecurringWork, 'id'>) => void
  onUpdateWork: (id: string, updates: Partial<RecurringWork>) => void
  onDeleteWork: (id: string) => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const DEFAULT_TIMEZONE = 'Asia/Tokyo'
const DEFAULT_SHIFT_LIMITS = { hours: 2, days: 1 }

export function RecurringWorkTable({
  recurringWorks,
  onAddWork,
  onUpdateWork,
  onDeleteWork,
}: RecurringWorkTableProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingWork, setEditingWork] = useState<Partial<RecurringWork>>({
    title: '',
    kind: 'soft',
    timezone: DEFAULT_TIMEZONE,
    pattern: { freq: 'WEEKLY', byWeekday: [] },
    startTime: '09:00',
    durationMinutes: 60,
    shiftLimits: DEFAULT_SHIFT_LIMITS,
    exclusions: [],
  })

  const handleAddWork = useCallback(() => {
    if (editingWork.title?.trim()) {
      onAddWork(editingWork as Omit<RecurringWork, 'id'>)
      setEditingWork({
        title: '',
        kind: 'soft',
        timezone: DEFAULT_TIMEZONE,
        pattern: { freq: 'WEEKLY', byWeekday: [] },
        startTime: '09:00',
        durationMinutes: 60,
        shiftLimits: DEFAULT_SHIFT_LIMITS,
        exclusions: [],
      })
      setShowAddDialog(false)
    }
  }, [editingWork, onAddWork])

  const toggleWeekday = useCallback((day: number) => {
    setEditingWork((prev) => {
      const current = prev.pattern?.byWeekday || []
      const updated = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort()
      return {
        ...prev,
        pattern: {
          ...prev.pattern,
          freq: prev.pattern?.freq || 'WEEKLY',
          byWeekday: updated,
        },
      }
    })
  }, [])

  const formatRecurrencePattern = (work: RecurringWork) => {
    if (work.pattern.freq === 'DAILY') {
      return '毎日'
    } else if (work.pattern.freq === 'WEEKLY' && work.pattern.byWeekday) {
      const days = work.pattern.byWeekday
        .sort()
        .map((d) => WEEKDAYS[d])
        .join('・')
      return `毎週 ${days}`
    }
    return '未設定'
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0 && mins > 0) {
      return `${hours}時間${mins}分`
    } else if (hours > 0) {
      return `${hours}時間`
    } else {
      return `${mins}分`
    }
  }

  return (
    <div className="space-y-4">
      {/* 定期作業リスト */}
      <div className="space-y-2">
        {recurringWorks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>定期作業が登録されていません</p>
            <p className="text-sm mt-1">定例会議や日次タスクなどを追加しましょう</p>
          </div>
        ) : (
          recurringWorks.map((work) => (
            <div
              key={work.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/5"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{work.title}</span>
                  <Badge
                    variant={work.kind === 'hard' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {work.kind === 'hard' ? '固定' : '調整可'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatRecurrencePattern(work)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {work.startTime} - {formatDuration(work.durationMinutes)}
                  </span>
                  {work.kind === 'soft' && work.shiftLimits && (
                    <span className="flex items-center gap-1">
                      <Settings className="h-3 w-3" />
                      ±{work.shiftLimits.hours}h / ±{work.shiftLimits.days}日
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteWork(work.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* 追加ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            定期作業を追加
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>定期作業の追加</DialogTitle>
            <DialogDescription>
              定例会議や日次タスクなど、定期的に行う作業を設定します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* タイトル */}
            <div className="space-y-2">
              <Label htmlFor="title">作業名</Label>
              <Input
                id="title"
                value={editingWork.title}
                onChange={(e) =>
                  setEditingWork((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="例：週次定例会議"
              />
            </div>

            {/* 種別 */}
            <div className="space-y-2">
              <Label>種別</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="kind"
                    value="hard"
                    checked={editingWork.kind === 'hard'}
                    onChange={() => setEditingWork((prev) => ({ ...prev, kind: 'hard' }))}
                  />
                  <span className="text-sm">固定（動かせない）</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="kind"
                    value="soft"
                    checked={editingWork.kind === 'soft'}
                    onChange={() => setEditingWork((prev) => ({ ...prev, kind: 'soft' }))}
                  />
                  <span className="text-sm">調整可（ずらせる）</span>
                </label>
              </div>
            </div>

            {/* 繰り返しパターン */}
            <div className="space-y-2">
              <Label>繰り返し</Label>
              <Select
                value={editingWork.pattern?.freq}
                onValueChange={(value: 'DAILY' | 'WEEKLY') =>
                  setEditingWork((prev) => ({
                    ...prev,
                    pattern: { ...prev.pattern, freq: value },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">毎日</SelectItem>
                  <SelectItem value="WEEKLY">毎週</SelectItem>
                </SelectContent>
              </Select>

              {/* 曜日選択（週次の場合） */}
              {editingWork.pattern?.freq === 'WEEKLY' && (
                <div className="flex gap-2 mt-2">
                  {WEEKDAYS.map((day, index) => (
                    <label
                      key={index}
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-md border cursor-pointer transition-colors',
                        editingWork.pattern?.byWeekday?.includes(index)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-accent'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={editingWork.pattern?.byWeekday?.includes(index)}
                        onChange={() => toggleWeekday(index)}
                      />
                      <span className="text-sm font-medium">{day}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 時間設定 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時刻</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={editingWork.startTime}
                  onChange={(e) =>
                    setEditingWork((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">所要時間（分）</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={editingWork.durationMinutes}
                  onChange={(e) =>
                    setEditingWork((prev) => ({
                      ...prev,
                      durationMinutes: parseInt(e.target.value) || 60,
                    }))
                  }
                />
              </div>
            </div>

            {/* シフト許容幅（softの場合） */}
            {editingWork.kind === 'soft' && (
              <div className="space-y-2">
                <Label>調整可能範囲</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">±</span>
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      value={editingWork.shiftLimits?.hours || 2}
                      onChange={(e) =>
                        setEditingWork((prev) => ({
                          ...prev,
                          shiftLimits: {
                            ...prev.shiftLimits,
                            hours: parseInt(e.target.value) || 2,
                            days: prev.shiftLimits?.days || 1,
                          },
                        }))
                      }
                      className="w-16"
                    />
                    <span className="text-sm">時間</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">±</span>
                    <Input
                      type="number"
                      min="0"
                      max="7"
                      value={editingWork.shiftLimits?.days || 1}
                      onChange={(e) =>
                        setEditingWork((prev) => ({
                          ...prev,
                          shiftLimits: {
                            ...prev.shiftLimits,
                            hours: prev.shiftLimits?.hours || 2,
                            days: parseInt(e.target.value) || 1,
                          },
                        }))
                      }
                      className="w-16"
                    />
                    <span className="text-sm">日</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  他のタスクと衝突した場合の調整可能範囲
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAddWork}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 情報メッセージ */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium">定期作業について</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>• 「固定」は必ず指定時刻に配置され、他のタスクを避けます</li>
            <li>• 「調整可」は他のタスクと衝突時に自動でシフトされます</li>
            <li>• 祝日や除外日は自動的にスキップされます</li>
          </ul>
        </div>
      </div>
    </div>
  )
}