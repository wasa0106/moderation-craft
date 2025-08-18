/**
 * BigTaskEditPopover - Inline editing popover for big tasks
 * Provides quick editing of essential task fields
 */

'use client'

import { useState } from 'react'
import { BigTask, UpdateBigTaskData } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface BigTaskEditPopoverProps {
  task: BigTask
  onUpdate: (params: { id: string; data: UpdateBigTaskData }) => Promise<BigTask>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function BigTaskEditPopover({
  task,
  onUpdate,
  isOpen,
  onOpenChange,
  children,
}: BigTaskEditPopoverProps) {
  const [formData, setFormData] = useState<UpdateBigTaskData>({
    name: task.name || '',
    estimated_hours: task.estimated_hours || 0,
    status: task.status || 'active',
    start_date: task.start_date || '',
    end_date: task.end_date || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showStartCalendar, setShowStartCalendar] = useState(false)
  const [showEndCalendar, setShowEndCalendar] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onUpdate({ id: task.id, data: formData })
      toast.success('タスクを更新しました')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('タスクの更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: task.name || '',
      estimated_hours: task.estimated_hours || 0,
      status: task.status || 'active',
      start_date: task.start_date || '',
      end_date: task.end_date || '',
    })
    onOpenChange(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">タスクを編集</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Task Name */}
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm">タスク名</Label>
              <Input
                id="name"
                value={(formData.name ?? '') as string}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-8"
              />
            </div>

            {/* Estimated Hours */}
            <div className="space-y-1">
              <Label htmlFor="estimated_hours" className="text-sm">見積時間（時間）</Label>
              <Input
                id="estimated_hours"
                type="number"
                min={0.5}
                max={168}
                step={0.5}
                value={(formData.estimated_hours ?? 0) as number}
                onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) })}
                className="h-8"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label htmlFor="status" className="text-sm">ステータス</Label>
              <Select
                value={(formData.status ?? 'active') as BigTask['status']}
                onValueChange={(value: BigTask['status']) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">実行中</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <Label htmlFor="start_date" className="text-sm">開始日</Label>
              <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-8 justify-start text-left font-normal',
                      !formData.start_date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {formData.start_date && typeof formData.start_date === 'string'
                      ? format(new Date(formData.start_date), 'yyyy年M月d日', { locale: ja })
                      : '開始日を選択'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date && typeof formData.start_date === 'string' ? new Date(formData.start_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ ...formData, start_date: format(date, 'yyyy-MM-dd') })
                        setShowStartCalendar(false)
                      }
                    }}
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <Label htmlFor="end_date" className="text-sm">終了日</Label>
              <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-8 justify-start text-left font-normal',
                      !formData.end_date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {formData.end_date && typeof formData.end_date === 'string'
                      ? format(new Date(formData.end_date), 'yyyy年M月d日', { locale: ja })
                      : '終了日を選択'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date && typeof formData.end_date === 'string' ? new Date(formData.end_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ ...formData, end_date: format(date, 'yyyy-MM-dd') })
                        setShowEndCalendar(false)
                      }
                    }}
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}