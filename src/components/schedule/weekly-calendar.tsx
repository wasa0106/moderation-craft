/**
 * WeeklyCalendar - 週間カレンダーコンポーネント
 * ドラッグ&ドロップで小タスクをスケジューリング
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { format, eachDayOfInterval, setHours, setMinutes, parseISO, isWeekend } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Calendar as CalendarIcon, Plus } from 'lucide-react'
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
import { WeeklySchedule, SmallTask, Project, BigTask, CreateSmallTaskData, UpdateSmallTaskData } from '@/types'
import { cn } from '@/lib/utils'
import { TaskCreateDialog } from './task-create-dialog'
import { TaskDetailDialog } from './task-detail-dialog'

interface WeeklyCalendarProps {
  weeklySchedule: WeeklySchedule
  onScheduleTask: (taskId: string, startTime: string, endTime: string) => Promise<void>
  onUnscheduleTask: (taskId: string) => Promise<void>
  onCreateTask: (data: CreateSmallTaskData) => Promise<void>
  onUpdateTask: (data: { id: string; data: UpdateSmallTaskData }) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  projects: Project[]
  bigTasks: BigTask[]
  userId: string
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
  isDragging = false,
}: {
  task: SmallTask
  color: string
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
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'p-2 rounded-lg cursor-move transition-all hover:scale-105 hover:shadow-lg',
        'bg-gradient-to-r text-white text-xs shadow-sm',
        color,
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
              className="text-xs px-1 py-0 bg-white/20 text-white border-white/30"
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
        'border-b border-r border-[#C9C7B6] p-1 min-h-[15px] transition-colors relative',
        hasTask ? '' : 'cursor-pointer',
        isWeekendDay ? 'bg-[#E4E5C0]/50' : 'bg-[#FCFAEC]',
        isOver && 'bg-[#E3E892]/30 ring-2 ring-[#5E621B]/50',
        isSelected && 'bg-[#5E621B]/20 ring-1 ring-[#5E621B]',
        isInSelection && 'bg-[#5E621B]/10',
        !hasTask && 'hover:bg-[#E3E892]/20'
      )}
    >
      {children}
    </div>
  )
}

export function WeeklyCalendar({
  weeklySchedule,
  onScheduleTask,
  onUnscheduleTask,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  projects,
  bigTasks,
  userId,
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
  
  // scheduleBlocksの内容をデバッグ表示
  useEffect(() => {
    console.log('WeeklyCalendar - scheduleBlocks:', {
      count: weeklySchedule.scheduleBlocks.length,
      blocks: weeklySchedule.scheduleBlocks.map(block => ({
        taskName: block.taskName,
        startTime: block.startTime,
        endTime: block.endTime,
        projectName: block.projectName
      }))
    })
  }, [weeklySchedule.scheduleBlocks])

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

  // BigTasksは既に親コンポーネントでフィルタリング済み
  console.log('WeeklyCalendar received BigTasks:', {
    weekStartDate: weeklySchedule.weekStartDate,
    weekEndDate: weeklySchedule.weekEndDate,
    bigTasksCount: bigTasks.length,
    bigTasks: bigTasks.map(t => ({ name: t.name, week_start_date: t.week_start_date, week_end_date: t.week_end_date }))
  })

  // Get project color
  const getProjectColor = (projectId: string): string => {
    const colors = [
      'from-[#3C6659] to-[#244E42]', // Material Green
      'from-[#5E621B] to-[#464A02]', // Material Olive
      'from-[#8C4332] to-[#68342A]', // Material Brown
      'from-[#5F6044] to-[#47492E]', // Material Gray-Green
    ]
    const index = projects.findIndex(p => p.id === projectId)
    return colors[index % colors.length] || colors[0]
  }

  // Handle time slot click for task creation
  const handleTimeSlotClick = useCallback((date: Date, hour: number, minute: number) => {
    if (dragSelection.isDragging) return
    
    console.log('handleTimeSlotClick called', { date, hour, minute })
    
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
    console.log('handleTaskClick called', { taskId })
    
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
        actual_minutes: null,
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
      if (hour === 0 && minute === 0) {
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

  // Get active task for drag overlay
  const activeTask = activeId ? weeklySchedule.unscheduledTasks.find(t => t.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        {/* BigTasks Sidebar */}
        <div className="w-64 border-r border-[#C9C7B6] bg-[#E5E3D2]">
          <div className="p-3 border-b border-[#C9C7B6]">
            <h3 className="text-sm font-semibold text-[#47473B] flex items-center gap-2">
              今週のタスク
              <Badge
                variant="secondary"
                className="text-xs bg-[#E4E5C0] text-[#47492E] border-[#D4D5B0]"
              >
                {bigTasks.length}
              </Badge>
            </h3>
          </div>

          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="p-3 space-y-3">
              {bigTasks.length === 0 ? (
                <p className="text-xs text-[#7B7D5F] text-center py-4">
                  今週のタスクはありません
                </p>
              ) : (
                // プロジェクトごとにグループ化
                projects.map(project => {
                  const projectBigTasks = bigTasks.filter(task => task.project_id === project.id)
                  if (projectBigTasks.length === 0) return null

                  return (
                    <div key={project.id} className="space-y-2">
                      {/* プロジェクトカード */}
                      <div className="bg-[#FCFAEC] rounded-lg border border-[#D4D2C1] overflow-hidden">
                        {/* プロジェクトヘッダー */}
                        <div className="px-3 py-2 bg-gradient-to-r from-[#E4E5C0] to-[#DDD9C8] border-b border-[#D4D2C1]">
                          <h4 className="text-xs font-semibold text-[#1C1C14] flex items-center gap-2">
                            <div 
                              className={cn(
                                "w-2 h-2 rounded-full",
                                "bg-gradient-to-r",
                                getProjectColor(project.id)
                              )}
                            />
                            {project.name}
                          </h4>
                        </div>
                        
                        {/* タスクリスト */}
                        <div className="divide-y divide-[#E5E3D2]">
                          {projectBigTasks.map(task => (
                            <div key={task.id} className="px-3 py-2 hover:bg-[#F5F3E4] transition-colors">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs px-1.5 py-0 h-5 bg-[#E5E3D2] border-[#C9C7B6] text-[#47473B]"
                                  >
                                    {task.category}
                                  </Badge>
                                  <span className="text-xs text-[#5E621B] font-medium">
                                    {task.estimated_hours}h
                                  </span>
                                </div>
                                <p className="text-xs text-[#1C1C14] line-clamp-2">
                                  {task.name}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* 合計時間 */}
                        <div className="px-3 py-2 bg-[#E5E3D2] border-t border-[#D4D2C1]">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#47473B]">合計</span>
                            <span className="font-semibold text-[#1C1C14]">
                              {projectBigTasks.reduce((sum, task) => sum + task.estimated_hours, 0)}時間
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[800px]">
            {/* Days Header */}
            <div className="grid grid-cols-8 border-b border-[#C9C7B6] sticky top-0 bg-[#E5E3D2] z-20">
              <div className="p-3 border-r border-[#C9C7B6]">
                <CalendarIcon className="h-4 w-4 text-[#5F6044] mx-auto" />
              </div>
              {weekDates.map(date => (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'p-3 border-r border-[#C9C7B6] text-center',
                    isWeekend(date) && 'bg-[#E4E5C0]/50'
                  )}
                >
                  <div className="text-sm font-medium text-[#1C1C14]">
                    {format(date, 'E', { locale: ja })}
                  </div>
                  <div className="text-xs text-[#47473B]">{format(date, 'M/d')}</div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="grid grid-cols-8">
              {/* Hours Column - showing every hour with 15-minute slots */}
              <div>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="border-b border-r border-[#C9C7B6] bg-[#E5E3D2]">
                    {/* 毎時間0分のところにのみ時刻を表示 */}
                    {[0, 15, 30, 45].map((minute) => (
                      <div
                        key={`${hour}-${minute}`}
                        className="h-[15px] text-xs text-[#47473B] px-2 flex items-center"
                      >
                        {minute === 0 && (
                          <span className="font-medium">{hour}:00</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Calendar Cells - 15-minute intervals */}
              {weekDates.map(date => (
                <div key={date.toISOString()}>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="border-b border-[#C9C7B6]">
                      {[0, 15, 30, 45].map((minute) => {
                        const scheduledTasks = getScheduledTasksForSlot(date, hour, minute)
                        const isSelected = selectedStartTime && selectedEndTime && 
                          isSlotInSelection(date, hour, minute)

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
                            {/* タスクを表示 */}
                            {scheduledTasks.map(block => {
                              const taskStart = parseISO(block.startTime)
                              const taskEnd = parseISO(block.endTime)
                              const taskHour = taskStart.getHours()
                              const taskMinute = taskStart.getMinutes()
                              
                              // タスクがこの時間帯に開始する場合のみ表示
                              if (taskHour === hour && taskMinute >= minute && taskMinute < minute + 15) {
                                const durationMinutes = Math.ceil(
                                  (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60)
                                )
                                const slots = Math.ceil(durationMinutes / 15)
                                
                                return (
                                  <div
                                    key={block.id}
                                    onClick={(e) => {
                                      console.log('Task clicked', { taskId: block.taskId })
                                      e.stopPropagation()
                                      e.preventDefault()
                                      handleTaskClick(block.taskId)
                                    }}
                                    onMouseDown={(e) => {
                                      // マウスダウンイベントでも伝播を止める
                                      e.stopPropagation()
                                    }}
                                    className={cn(
                                      'absolute inset-x-0 mx-1 p-1 rounded text-white text-xs cursor-pointer shadow-sm z-[1]',
                                      'bg-gradient-to-r hover:opacity-80 transition-opacity',
                                      getProjectColor(block.projectId)
                                    )}
                                    style={{
                                      top: `${(taskMinute % 15) * (100 / 15)}%`,
                                      height: `${slots * 15}px`,
                                    }}
                                  >
                                    <div className="font-medium truncate">{block.taskName}</div>
                                    <div className="text-xs opacity-75">
                                      {format(taskStart, 'HH:mm')} - {format(taskEnd, 'HH:mm')}
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            })}
                          </DroppableTimeSlot>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeTask && (
          <div className="opacity-90">
            <DraggableTask task={activeTask} color={getProjectColor(activeTask.project_id || '')} />
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
    </DndContext>
  )
}
