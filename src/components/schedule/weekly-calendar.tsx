/**
 * WeeklyCalendar - 週間カレンダーコンポーネント
 * ドラッグ&ドロップで小タスクをスケジューリング
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format, eachDayOfInterval, setHours, setMinutes, parseISO, isWeekend } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, ChevronLeft, ChevronRight, Moon } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { WeeklySchedule, SmallTask, Project, BigTask, CreateSmallTaskData, UpdateSmallTaskData, SleepSchedule } from '@/types'
import { cn } from '@/lib/utils'
import { TaskCreateDialog } from './task-create-dialog'
import { TaskDetailDialog } from './task-detail-dialog'
import { WeeklySleepScheduleDialog } from './weekly-sleep-schedule-dialog'
import { useWeeklySleepSchedules, generateSleepBlocks } from '@/hooks/use-sleep-schedule'

interface WeeklyCalendarProps {
  weeklySchedule: WeeklySchedule
  onScheduleTask: (taskId: string, startTime: string, endTime: string) => Promise<void>
  onCreateTask: (data: CreateSmallTaskData) => Promise<void>
  onUpdateTask: (data: { id: string; data: UpdateSmallTaskData }) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  projects: Project[]
  bigTasks: BigTask[]
  smallTasks?: SmallTask[]
  userId: string
  weekStart: Date
  onPreviousWeek: () => void
  onNextWeek: () => void
}

interface TimeSlot {
  date: Date
  hour: number
  minute?: number
}

interface DragSelection {
  startSlot: TimeSlot | null
  endSlot: TimeSlot | null
  isDragging: boolean
}

// Draggable task component
function DraggableTask({
  task,
  color,
  project,
  isDragging = false,
}: {
  task: SmallTask
  color: string
  project?: Project
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: {
      task,
      estimatedMinutes: task.estimated_minutes,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(project?.color ? {
          backgroundColor: project.color,
          '--custom-color': project.color,
        } : {})
      }}
      {...listeners}
      {...attributes}
      className={cn(
        'p-2 rounded-lg cursor-move transition-all hover:scale-105 hover:shadow-sm',
        'text-xs shadow-sm border',
        project?.color ? 'text-primary-foreground border-border' : color,
        isDragging && 'opacity-50'
      )}
    >
      <div className="font-medium truncate">{task.name}</div>
      <div className="flex items-center gap-1 mt-1 opacity-90">
        <Clock className="h-3 w-3" />
        <span>{task.estimated_minutes}分</span>
      </div>
      {task.tags && task.tags.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {task.tags.slice(0, 2).map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs px-1 py-0 bg-muted/50 text-muted-foreground border-border"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// Droppable time slot component with 15-minute quarters
function DroppableTimeSlot({
  date,
  hour,
  minute,
  children,
  isWeekendDay,
  onClick,
  onMouseDown,
  onMouseEnter,
  isSelected,
  isInSelection,
  hasTask = false,
}: {
  date: Date
  hour: number
  minute: number
  children?: React.ReactNode
  isWeekendDay: boolean
  onClick?: () => void
  onMouseDown?: () => void
  onMouseEnter?: () => void
  isSelected?: boolean
  isInSelection?: boolean
  hasTask?: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${format(date, 'yyyy-MM-dd')}-${hour}-${minute}`,
    data: {
      date,
      hour,
      minute,
    } as TimeSlot,
  })

  return (
    <div
      ref={setNodeRef}
      onClick={hasTask ? undefined : onClick}
      onMouseDown={hasTask ? undefined : onMouseDown}
      onMouseEnter={onMouseEnter}
      className={cn(
        'border-r border-border p-1 min-h-[12px] transition-colors relative overflow-visible',
        hasTask ? 'z-10' : 'cursor-pointer',
        'bg-surface-1',
        isWeekendDay && 'opacity-95',
        isOver && 'bg-primary/10 ring-2 ring-primary/50',
        isSelected && 'bg-primary/20 ring-1 ring-primary',
        isInSelection && 'bg-primary/10',
        !hasTask && 'hover:bg-surface-2'
      )}
    >
      {children}
    </div>
  )
}

export function WeeklyCalendar({
  weeklySchedule,
  onScheduleTask,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  projects,
  bigTasks,
  smallTasks = [],
  userId,
  weekStart,
  onPreviousWeek,
  onNextWeek,
}: WeeklyCalendarProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [dragSelection, setDragSelection] = useState<DragSelection>({
    startSlot: null,
    endSlot: null,
    isDragging: false,
  })
  const [selectedStartTime, setSelectedStartTime] = useState<Date | null>(null)
  const [selectedEndTime, setSelectedEndTime] = useState<Date | null>(null)
  const [selectedTask, setSelectedTask] = useState<SmallTask | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showWeeklySleepDialog, setShowWeeklySleepDialog] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // scheduleBlocksの内容をデバッグ表示
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('WeeklyCalendar - scheduleBlocks:', {
        count: weeklySchedule.scheduleBlocks.length,
        blocks: weeklySchedule.scheduleBlocks.map(block => ({
          taskName: block.taskName,
          startTime: block.startTime,
          endTime: block.endTime,
          projectName: block.projectName
        }))
      })
    }
  }, [weeklySchedule.scheduleBlocks])

  // コンポーネントマウント時に5:00の位置から開始
  useEffect(() => {
    if (scrollContainerRef.current) {
      // 1時間 = 48px (12px × 4スロット)
      const hourHeight = 48
      // 5時間分のオフセット
      const scrollPosition = 5 * hourHeight

      // 即座にスクロール位置を設定（アニメーションなし）
      scrollContainerRef.current.scrollTop = scrollPosition
    }
  }, []) // 空の依存配列で初回マウント時のみ実行

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Get week dates
  const weekDates = useMemo(() => {
    return eachDayOfInterval({
      start: parseISO(weeklySchedule.weekStartDate),
      end: parseISO(weeklySchedule.weekEndDate),
    })
  }, [weeklySchedule])

  // Get sleep schedules for the week
  const { data: weeklySleepData } = useWeeklySleepSchedules(userId, weekStart)
  
  // Generate sleep blocks for all days
  const sleepBlocks = useMemo(() => {
    if (!weeklySleepData) return []
    
    interface SleepBlock {
      date: string
      type: 'sleep-single' | 'sleep-start' | 'sleep-end'
      startHour: number
      startMinute: number
      endHour: number
      endMinute: number
      schedule: SleepSchedule
    }
    const blocks: SleepBlock[] = []
    weeklySleepData.forEach(({ schedule, dateOfSleep }) => {
      if (schedule) {
        const dayBlocks = generateSleepBlocks(schedule)
        blocks.push(...dayBlocks)
        
        // デバッグ: 日曜日の睡眠ブロックの生成を確認
        if (process.env.NODE_ENV === 'development' && dateOfSleep.includes('月')) {
          console.log('月曜日の睡眠データ:', {
            dateOfSleep,
            scheduledStart: schedule.scheduled_start_time,
            scheduledEnd: schedule.scheduled_end_time,
            generatedBlocks: dayBlocks
          })
        }
      }
    })
    
    // デバッグ: 生成された全睡眠ブロックを確認
    if (process.env.NODE_ENV === 'development') {
      console.log('生成された睡眠ブロック:', {
        totalBlocks: blocks.length,
        blocks: blocks.map(b => ({
          date: b.date,
          type: b.type,
          startHour: b.startHour,
          endHour: b.endHour
        }))
      })
    }
    
    return blocks
  }, [weeklySleepData])

  // BigTasksは既に親コンポーネントでフィルタリング済み
  if (process.env.NODE_ENV === 'development') {
    console.log('WeeklyCalendar received BigTasks:', {
      weekStartDate: weeklySchedule.weekStartDate,
      weekEndDate: weeklySchedule.weekEndDate,
      bigTasksCount: bigTasks.length,
      bigTasks: bigTasks.map(t => ({
        name: t.name,
        start_date: t.start_date,
        end_date: t.end_date,
        category: t.category
      }))
    })
  }

  // Get project color - メモ化してパフォーマンスを最適化
  const getProjectColor = useCallback((projectId: string): string => {
    const project = projects.find(p => p.id === projectId)

    // プロジェクトにカラーが設定されている場合
    if (project?.color) {
      // HSLカラーをインラインスタイルで適用するためのクラスを返す
      // Note: 実際の色はstyle属性で設定するため、ここではベースクラスのみ返す
      return 'text-primary-foreground border'
    }

    // フォールバック: インデックスベースの色
    const index = projects.findIndex(p => p.id === projectId)
    const colorClasses = [
      'bg-accent text-accent-foreground border-border',
      'bg-info text-info-foreground border-border',
      'bg-secondary text-secondary-foreground border-border',
      'bg-muted text-muted-foreground border-border',
    ]
    return colorClasses[index % colorClasses.length] || colorClasses[0]
  }, [projects])

  // Calculate BigTask progress from SmallTasks
  const bigTaskProgress = useMemo(() => {
    const progressMap = new Map<string, number>()
    
    // SmallTaskをBigTaskごとに集計
    smallTasks.forEach(task => {
      if (task.big_task_id) {
        const current = progressMap.get(task.big_task_id) || 0
        progressMap.set(task.big_task_id, current + task.estimated_minutes)
      }
    })
    
    return progressMap
  }, [smallTasks])

  // Handle time slot click for task creation
  const handleTimeSlotClick = useCallback((date: Date, hour: number, minute: number) => {
    if (dragSelection.isDragging) return

    if (process.env.NODE_ENV === 'development') {
      console.log('handleTimeSlotClick called', { date, hour, minute })
    }

    const clickedTime = new Date(date)
    clickedTime.setHours(hour, minute, 0, 0)

    // デフォルトで30分のタスクを作成
    const endTime = new Date(clickedTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    setSelectedStartTime(clickedTime)
    setSelectedEndTime(endTime)
    setShowCreateDialog(true)
  }, [dragSelection.isDragging])


  // Handle drag selection start
  const handleSelectionStart = useCallback((date: Date, hour: number, minute: number) => {
    const slot = { date, hour, minute }
    setDragSelection({
      startSlot: slot,
      endSlot: slot,
      isDragging: true,
    })
  }, [])

  // Handle drag selection move
  const handleSelectionMove = useCallback((date: Date, hour: number, minute: number) => {
    if (!dragSelection.isDragging || !dragSelection.startSlot) return

    setDragSelection(prev => ({
      ...prev,
      endSlot: { date, hour, minute },
    }))
  }, [dragSelection.isDragging, dragSelection.startSlot])

  // Handle drag selection end
  const handleSelectionEnd = useCallback(() => {
    if (!dragSelection.isDragging || !dragSelection.startSlot || !dragSelection.endSlot) {
      setDragSelection({ startSlot: null, endSlot: null, isDragging: false })
      return
    }

    // 開始時刻と終了時刻を計算
    const startTime = new Date(dragSelection.startSlot.date)
    startTime.setHours(dragSelection.startSlot.hour, dragSelection.startSlot.minute || 0, 0, 0)

    const endTime = new Date(dragSelection.endSlot.date)
    endTime.setHours(dragSelection.endSlot.hour, dragSelection.endSlot.minute || 0, 0, 0)

    // 終了時刻が開始時刻より前の場合は入れ替える
    if (endTime < startTime) {
      setSelectedStartTime(endTime)
      setSelectedEndTime(startTime)
    } else {
      // 少なくとも15分は確保
      if (endTime.getTime() - startTime.getTime() < 15 * 60 * 1000) {
        endTime.setMinutes(startTime.getMinutes() + 15)
      }
      setSelectedStartTime(startTime)
      setSelectedEndTime(endTime)
    }

    setShowCreateDialog(true)
    setDragSelection({ startSlot: null, endSlot: null, isDragging: false })
  }, [dragSelection])

  // マウスアップイベントをウィンドウ全体で監視
  useEffect(() => {
    const handleMouseUp = () => {
      if (dragSelection.isDragging) {
        handleSelectionEnd()
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [dragSelection.isDragging, handleSelectionEnd])

  // Handle task click to show details
  const handleTaskClick = useCallback((taskId: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('handleTaskClick called', { taskId })
    }

    // unscheduledTasksとscheduleBlocksからタスクを探す
    const unscheduledTask = weeklySchedule.unscheduledTasks.find(t => t.id === taskId)
    if (unscheduledTask) {
      setSelectedTask(unscheduledTask)
      setShowDetailDialog(true)
      return
    }

    // scheduleBlocksからタスク情報を構築
    const block = weeklySchedule.scheduleBlocks.find(b => b.taskId === taskId)
    if (block) {
      // 最小限のSmallTask情報を構築
      const smallTask: SmallTask = {
        id: block.taskId,
        name: block.taskName,
        project_id: block.projectId,
        big_task_id: '', // 後で取得が必要
        user_id: userId,
        estimated_minutes: Math.ceil(
          (new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) / (1000 * 60)
        ),
        scheduled_start: block.startTime,
        scheduled_end: block.endTime,
        tags: block.tags || [],
        notes: '',
        status: 'pending',
        is_emergency: false,
        created_at: '',
        updated_at: '',
        completed_at: null,
        actual_minutes: undefined,
        completed_notes: null,
      }
      setSelectedTask(smallTask)
      setShowDetailDialog(true)
    }
  }, [weeklySchedule, userId])

  // Check if a time slot is in the selection range
  const isSlotInSelection = useCallback((date: Date, hour: number, minute: number) => {
    if (!dragSelection.startSlot || !dragSelection.endSlot || !dragSelection.isDragging) {
      return false
    }

    const slotTime = new Date(date)
    slotTime.setHours(hour, minute, 0, 0)

    const startTime = new Date(dragSelection.startSlot.date)
    startTime.setHours(dragSelection.startSlot.hour, dragSelection.startSlot.minute || 0, 0, 0)

    const endTime = new Date(dragSelection.endSlot.date)
    endTime.setHours(dragSelection.endSlot.hour, dragSelection.endSlot.minute || 0, 0, 0)

    const minTime = startTime < endTime ? startTime : endTime
    const maxTime = startTime < endTime ? endTime : startTime

    return slotTime >= minTime && slotTime <= maxTime
  }, [dragSelection])

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    const taskId = active.id as string
    const task = weeklySchedule.unscheduledTasks.find(t => t.id === taskId)

    if (!task) {
      setActiveId(null)
      return
    }

    const dropData = over.data.current as TimeSlot
    const startTime = setHours(setMinutes(dropData.date, dropData.minute || 0), dropData.hour)
    const endMinutes = (dropData.minute || 0) + task.estimated_minutes
    const endHour = dropData.hour + Math.floor(endMinutes / 60)
    const endMinute = endMinutes % 60
    const endTime = setHours(setMinutes(dropData.date, endMinute), endHour)

    await onScheduleTask(taskId, startTime.toISOString(), endTime.toISOString())

    setActiveId(null)
  }

  // Get scheduled tasks for a specific time slot (15-minute granularity)
  const getScheduledTasksForSlot = (date: Date, hour: number, minute: number) => {
    const slotStart = new Date(date)
    slotStart.setHours(hour, minute, 0, 0)
    const slotEnd = new Date(slotStart)
    slotEnd.setMinutes(slotEnd.getMinutes() + 15)

    const tasks = weeklySchedule.scheduleBlocks.filter(block => {
      const taskStart = parseISO(block.startTime)
      const taskEnd = parseISO(block.endTime)

      // Check if task overlaps with this time slot
      const overlaps = (
        taskStart < slotEnd &&
        taskEnd > slotStart &&
        format(taskStart, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      )

      // デバッグ: 最初のスロットでのみログ出力
      if (process.env.NODE_ENV === 'development' && hour === 0 && minute === 0) {
        console.log('タスクスロットチェック:', {
          date: format(date, 'yyyy-MM-dd'),
          taskName: block.taskName,
          taskStart: format(taskStart, 'yyyy-MM-dd HH:mm'),
          taskEnd: format(taskEnd, 'yyyy-MM-dd HH:mm'),
          slotStart: format(slotStart, 'yyyy-MM-dd HH:mm'),
          slotEnd: format(slotEnd, 'yyyy-MM-dd HH:mm'),
          overlaps
        })
      }

      return overlaps
    })

    return tasks
  }

  // Get scheduled tasks for a specific hour
  const getScheduledTasksForHour = (date: Date, hour: number) => {
    const hourStart = new Date(date)
    hourStart.setHours(hour, 0, 0, 0)
    const hourEnd = new Date(date)
    hourEnd.setHours(hour + 1, 0, 0, 0)

    const tasks = weeklySchedule.scheduleBlocks.filter(block => {
      const taskStart = parseISO(block.startTime)
      const taskEnd = parseISO(block.endTime)

      // Check if task starts in this hour
      const startsInHour = (
        taskStart >= hourStart &&
        taskStart < hourEnd &&
        format(taskStart, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      )

      return startsInHour
    })

    return tasks
  }

  // Get sleep blocks for a specific time slot
  const getSleepBlocksForSlot = (date: Date, hour: number, minute: number) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    return sleepBlocks.filter(block => {
      if (block.date !== dateStr) return false
      
      const slotTime = hour * 60 + minute
      const blockStart = block.startHour * 60 + block.startMinute
      const blockEnd = block.endHour * 60 + block.endMinute
      
      // Check if this slot is within the sleep block
      return slotTime >= blockStart && slotTime < blockEnd
    })
  }

  // Get active task for drag overlay
  const activeTask = activeId ? weeklySchedule.unscheduledTasks.find(t => t.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
          <div className="min-w-[800px]">
            {/* Days Header */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border sticky top-0 bg-muted z-20">
              <div className="py-1.5 px-2">
                {/* 空欄 */}
              </div>
              {weekDates.map(date => (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'py-1.5 px-2 text-center flex flex-col justify-end relative',
                    isWeekend(date) && 'opacity-90'
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {format(date, 'E', { locale: ja })}
                  </div>
                  <div className="text-2xl text-foreground">{format(date, 'd')}</div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
              {/* Hours Column - showing every hour with 15-minute slots */}
              <div>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="border-r border-border bg-muted relative">
                    {/* 時刻表示を絶対配置で時間の境界に配置 */}
                    {hour !== 0 && (
                      <div className="absolute -top-[10px] right-2 bg-muted px-1">
                        <span className="text-xs font-medium text-muted-foreground">{hour}:00</span>
                      </div>
                    )}
                    {/* 15分スロット */}
                    {[0, 15, 30, 45].map((minute) => (
                      <div
                        key={`${hour}-${minute}`}
                        className="h-[12px]"
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Calendar Cells - 15-minute intervals */}
              {weekDates.map(date => (
                <div key={date.toISOString()}>
                  {Array.from({ length: 24 }, (_, hour) => {
                    // この時間に開始するタスクを取得
                    const hourTasks = getScheduledTasksForHour(date, hour)
                    
                    return (
                      <div key={hour} className="border-b border-border relative">
                        {/* 15分スロット */}
                        {[0, 15, 30, 45].map((minute) => {
                          const scheduledTasks = getScheduledTasksForSlot(date, hour, minute)
                          const sleepBlocks = getSleepBlocksForSlot(date, hour, minute)
                          const isSelected = !!(selectedStartTime && selectedEndTime &&
                            isSlotInSelection(date, hour, minute))

                          return (
                            <DroppableTimeSlot
                              key={`${date}-${hour}-${minute}`}
                              date={date}
                              hour={hour}
                              minute={minute}
                              isWeekendDay={isWeekend(date)}
                              onClick={() => handleTimeSlotClick(date, hour, minute)}
                              onMouseDown={() => handleSelectionStart(date, hour, minute)}
                              onMouseEnter={() => handleSelectionMove(date, hour, minute)}
                              isSelected={isSelected}
                              isInSelection={isSlotInSelection(date, hour, minute)}
                              hasTask={scheduledTasks.length > 0}
                            >
                              {/* 睡眠ブロックを表示（背景として） */}
                              {sleepBlocks.length > 0 && (
                                <div 
                                  className="absolute inset-0 bg-slate-800 opacity-30 pointer-events-none"
                                  style={{ zIndex: 0 }}
                                />
                              )}
                            </DroppableTimeSlot>
                          )
                        })}
                        
                        {/* タスクを時間コンテナ直下に配置 */}
                        {hourTasks.map(block => {
                          const taskStart = parseISO(block.startTime)
                          const taskEnd = parseISO(block.endTime)
                          const taskMinute = taskStart.getMinutes()
                          const durationMinutes = Math.ceil(
                            (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60)
                          )
                          const slots = Math.ceil(durationMinutes / 15)

                          const blockProject = projects.find(p => p.id === block.projectId)
                          const colorClass = getProjectColor(block.projectId)

                          return (
                            <div
                              key={block.id}
                              onClick={(e) => {
                                if (process.env.NODE_ENV === 'development') {
                                  console.log('Task clicked', { taskId: block.taskId })
                                }
                                e.stopPropagation()
                                e.preventDefault()
                                handleTaskClick(block.taskId)
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                              }}
                              className={cn(
                                'absolute left-0 right-0 mx-1 rounded text-xs cursor-pointer shadow-sm z-[20]',
                                'border hover:opacity-80 transition-opacity overflow-hidden',
                                slots <= 2 ? 'p-0.5' : 'p-1',
                                blockProject?.color ? 'text-primary-foreground border-border' : colorClass
                              )}
                              style={{
                                top: `${(taskMinute / 15) * 12}px`,
                                height: `${slots * 12}px`,
                                ...(blockProject?.color ? { backgroundColor: blockProject.color } : {})
                              }}
                            >
                              {/* タスクの長さに応じて表示内容を調整 */}
                              {slots === 1 ? (
                                <div className="font-medium truncate leading-[10px]">{block.taskName}</div>
                              ) : slots === 2 ? (
                                <div className="flex items-center h-full">
                                  <div className="font-medium truncate w-full">{block.taskName}</div>
                                </div>
                              ) : slots === 3 ? (
                                <>
                                  <div className="font-medium truncate">{block.taskName}</div>
                                  <div className="text-[10px] opacity-75 truncate">
                                    {format(taskStart, 'H:mm')}-{format(taskEnd, 'H:mm')}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="font-medium truncate">{block.taskName}</div>
                                  <div className="text-xs opacity-75">
                                    {format(taskStart, 'HH:mm')} - {format(taskEnd, 'HH:mm')}
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BigTasks Sidebar */}
        <div className="w-72 border-l border-border bg-card flex flex-col">
          {/* 週送りセクション */}
          <div className="p-3 border-b border-border">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Button
                  onClick={onPreviousWeek}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:bg-surface-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="text-center flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {format(weekStart, 'yyyy年M月', { locale: ja })}
                  </div>
                </div>

                <Button
                  onClick={onNextWeek}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:bg-surface-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {/* 週間睡眠設定ボタン */}
              <Button
                onClick={() => setShowWeeklySleepDialog(true)}
                variant="outline"
                size="sm"
                className="w-full flex items-center gap-2"
              >
                <Moon className="w-4 h-4" />
                週間睡眠設定
              </Button>
            </div>
          </div>

          {/* 今週のタスクセクション */}
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              今週のタスク
              <Badge
                variant="secondary"
                className="text-xs bg-secondary text-secondary-foreground"
              >
                {bigTasks.filter(task => task.category !== 'その他').length}
              </Badge>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="py-2">
              {bigTasks.filter(task => task.category !== 'その他').length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  今週のタスクはありません
                </p>
              ) : (
                // プロジェクトごとにグループ化（シンプルなリスト形式）
                projects.map(project => {
                  const projectBigTasks = bigTasks.filter(task => 
                    task.project_id === project.id && task.category !== 'その他'
                  )
                  if (projectBigTasks.length === 0) return null

                  return (
                    <div key={project.id} className="mb-3">
                      {/* プロジェクトヘッダー（軽量化） */}
                      <div className="flex items-center gap-2 px-3 py-1 border-b border-border/50">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={project.color ? { backgroundColor: project.color } : {}}
                        />
                        <span className="text-sm font-semibold text-foreground">
                          {project.name}
                        </span>
                      </div>

                      {/* タスクリスト（シンプル化） */}
                      <div className="space-y-0.5">
                        {projectBigTasks.map(task => (
                          <div
                            key={task.id}
                            className="pl-9 pr-3 py-1 hover:bg-surface-1 rounded-sm cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-foreground flex-1 truncate min-w-0">
                                {task.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {(() => {
                                  const completedMinutes = bigTaskProgress.get(task.id) || 0
                                  const completedHours = (completedMinutes / 60).toFixed(1)
                                  return `${completedHours}h/${task.estimated_hours}h`
                                })()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeTask && (
          <div className="opacity-90">
            <DraggableTask
              task={activeTask}
              color={getProjectColor(activeTask.project_id || '')}
              project={activeTask.task_type !== 'routine' ? projects.find(p => p.id === activeTask.project_id) : undefined}
            />
          </div>
        )}
      </DragOverlay>

      {/* Task Create Dialog */}
      <TaskCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        startTime={selectedStartTime}
        endTime={selectedEndTime}
        projects={projects}
        bigTasks={bigTasks}
        onCreateTask={async (data) => {
          await onCreateTask(data)
          setShowCreateDialog(false)
        }}
        userId={userId}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        task={selectedTask}
        projects={projects}
        bigTasks={bigTasks}
        onUpdateTask={async (data) => {
          await onUpdateTask(data)
          setShowDetailDialog(false)
          setSelectedTask(null)
        }}
        onDeleteTask={async (taskId) => {
          await onDeleteTask(taskId)
          setShowDetailDialog(false)
          setSelectedTask(null)
        }}
      />

      {/* Weekly Sleep Schedule Dialog */}
      <WeeklySleepScheduleDialog
        open={showWeeklySleepDialog}
        onOpenChange={setShowWeeklySleepDialog}
        weekStart={weekStart}
        userId={userId}
      />
    </DndContext>
  )
}
