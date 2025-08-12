'use client'

import { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { useTimerStore } from '@/stores/timer-store'
import { SmallTask, Project } from '@/types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getProjectOverlayColor, getProjectBorderColor } from '@/lib/utils/project-colors'

interface TimerTaskDisplayProps {
  smallTasks: SmallTask[]
  projects: Project[]
  dayTasks: SmallTask[]
  onUnplannedTaskClick: (taskName?: string) => void  // タスク名を受け取れるように
  onTaskChange?: (task: SmallTask) => Promise<void>
  onTaskSelect?: (task: SmallTask) => void  // タスク選択時にWorkSessionを開始
}

export interface TimerTaskDisplayRef {
  openPopover: () => void
}

export const TimerTaskDisplay = forwardRef<TimerTaskDisplayRef, TimerTaskDisplayProps>(
  ({ smallTasks, projects, dayTasks, onUnplannedTaskClick, onTaskChange, onTaskSelect }, ref) => {
    const { currentTask, currentProject, setCurrentTask, setCurrentProject, isRunning } = useTimerStore()
    const [popoverOpen, setPopoverOpen] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const [isInputMode, setIsInputMode] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      openPopover: () => setPopoverOpen(true),
    }))

    // Popoverが開いた時のフォーカス制御
    useEffect(() => {
      if (popoverOpen && isInputMode) {
        setTimeout(() => {
          // 入力フィールドが存在する場合は、入力フィールドを優先
          if (inputRef.current) {
            inputRef.current.focus()
          } else {
            // 入力フィールドがない場合のみCommandInputにフォーカス
            const commandInput = document.querySelector('[cmdk-input]') as HTMLInputElement
            commandInput?.focus()
          }
        }, 0)
      }
    }, [popoverOpen, isInputMode])

    // ArrowUpキーでCommandInputから入力モードに切り替えて入力フィールドに戻る
    useEffect(() => {
      if (!popoverOpen) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
          const commandInput = document.querySelector('[cmdk-input]') as HTMLInputElement
          if (document.activeElement === commandInput) {
            e.preventDefault()
            setPopoverOpen(false)
            setIsInputMode(true)  // 入力モードに切り替え
            // 次のレンダリング後に入力フィールドにフォーカス
            setTimeout(() => {
              inputRef.current?.focus()
            }, 0)
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [popoverOpen])

    // Popoverが開いている時にEscapeで入力モードに切り替え
    useEffect(() => {
      if (!popoverOpen) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          const commandInput = document.querySelector('[cmdk-input]') as HTMLInputElement
          if (document.activeElement === commandInput) {
            e.preventDefault()
            setPopoverOpen(false)
            setIsInputMode(true)
            // 次のレンダリング後に入力フィールドにフォーカス
            setTimeout(() => {
              inputRef.current?.focus()
            }, 0)
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [popoverOpen])


    const getProjectForTask = (task: SmallTask): Project | undefined => {
      return task.task_type !== 'routine' ? projects.find(p => p.id === task.project_id) : undefined
    }

    const handleTaskSelect = (value: string) => {
      const task = smallTasks.find(t => t.id === value)
      if (task) {
        setCurrentTask(task)
        const project = getProjectForTask(task)
        setCurrentProject(project || null)

        // タイマーが動いている場合は既存のonTaskChangeを呼ぶ（タスクの切り替え）
        if (isRunning && onTaskChange) {
          onTaskChange(task).catch(error => {
            console.error('Failed to change task:', error)
          })
        } 
        // タイマーが動いていない場合は新しいonTaskSelectを呼ぶ（WorkSession開始）
        else if (!isRunning && onTaskSelect) {
          onTaskSelect(task)
        }
        
        setPopoverOpen(false)
      }
    }

    // Command部分を共通化
    const renderCommandContent = () => (
      <Command filter={(value, search) => {
        // タスクIDから実際のタスクを取得
        const task = smallTasks.find(t => t.id === value)
        if (!task) return 0
        
        // タスク名とプロジェクト名で検索（大文字小文字を無視）
        const searchLower = search.toLowerCase()
        const taskNameMatch = task.name.toLowerCase().includes(searchLower)
        const project = getProjectForTask(task)
        const projectNameMatch = project?.name.toLowerCase().includes(searchLower) ?? false
        
        return (taskNameMatch || projectNameMatch) ? 1 : 0
      }}>
        <CommandInput placeholder="Search tasks..." />
        <CommandEmpty>No task found.</CommandEmpty>
        <CommandGroup>
          {smallTasks
            .filter(task => task.status !== 'completed' && task.task_type !== 'routine')
            .sort((a, b) => {
              const aIsToday = dayTasks.some(t => t.id === a.id)
              const bIsToday = dayTasks.some(t => t.id === b.id)
              if (aIsToday && !bIsToday) return -1
              if (!aIsToday && bIsToday) return 1
              
              if (!a.scheduled_start || !b.scheduled_start) {
                return a.name.localeCompare(b.name)
              }
              
              const aDate = new Date(a.scheduled_start)
              const bDate = new Date(b.scheduled_start)
              if (aDate < bDate) return -1
              if (aDate > bDate) return 1
              
              return a.name.localeCompare(b.name)
            })
            .map(task => {
              const project = getProjectForTask(task)
              const isToday = dayTasks.some(t => t.id === task.id)
              return (
                <CommandItem 
                  key={task.id} 
                  value={task.id} 
                  onSelect={handleTaskSelect}
                  className={isToday ? 'bg-accent/10' : ''}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {/* プロジェクトカラーインジケーター */}
                    {task.task_type === 'routine' ? (
                      <div className="w-1 h-6 rounded-full shrink-0 bg-amber-500" />
                    ) : project ? (
                      <div 
                        className="w-1 h-6 rounded-full shrink-0" 
                        style={{ backgroundColor: project.color || 'var(--accent)' }}
                      />
                    ) : (
                      <div className="w-1 h-6" />
                    )}
                    
                    <span className={cn(
                      !isToday ? 'text-muted-foreground' : 'font-medium',
                    )}>
                      {task.task_type === 'routine' && <span className="opacity-60">⚡ </span>}
                      {task.name}
                    </span>
                    
                    {task.task_type === 'routine' ? (
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                        style={{
                          backgroundColor: 'rgb(251, 191, 36, 0.1)',
                          borderColor: 'rgb(251, 191, 36)',
                        }}
                      >
                        ルーチン
                      </Badge>
                    ) : project ? (
                      <Badge 
                        variant={isToday ? 'secondary' : 'outline'} 
                        className="text-xs"
                        style={project.color ? {
                          backgroundColor: getProjectOverlayColor(project.color),
                          borderColor: getProjectBorderColor(project.color),
                        } : undefined}
                      >
                        {project.name}
                      </Badge>
                    ) : null}
                    
                    {!isToday && task.scheduled_start && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(task.scheduled_start), 'M/d')}
                      </span>
                    )}
                  </div>
                </CommandItem>
              )
            })}
        </CommandGroup>
      </Command>
    )

    // 入力モード時はPopoverの外に配置
    if (isInputMode && !currentTask) {
      return (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                onUnplannedTaskClick(inputValue)
                setInputValue('')
                setIsInputMode(false)
              }
              if (e.key === 'Escape') {
                setInputValue('')
                setIsInputMode(false)
              }
              // ↓キーでPopoverを開く、または既に開いている場合はCommandInputにフォーカス
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (!popoverOpen) {
                  setPopoverOpen(true)
                } else {
                  // Popoverが既に開いている場合はCommandInputにフォーカス
                  const commandInput = document.querySelector('[cmdk-input]') as HTMLInputElement
                  commandInput?.focus()
                }
              }
            }}
            onBlur={() => {
              if (!inputValue.trim()) {
                setIsInputMode(false)
              }
            }}
            placeholder="What are you working on?"
            className="text-xl bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground focus:placeholder:text-transparent w-full"
            autoFocus
          />
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <span className="absolute inset-0 pointer-events-none" />
            </PopoverTrigger>
            <PopoverContent className="w-[480px] p-0" align="start">
              {renderCommandContent()}
            </PopoverContent>
          </Popover>
        </div>
      )
    }

    // 通常のPopover表示
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div className="cursor-pointer">
            {currentTask ? (
              <div>
                <h1 className="text-xl font-semibold text-foreground truncate">
                  {currentTask.name}
                </h1>
                {currentTask.task_type === 'routine' ? (
                  <p className="text-sm text-muted-foreground">フリータスク</p>
                ) : currentProject ? (
                  <p className="text-sm text-muted-foreground">{currentProject.name}</p>
                ) : null}
              </div>
            ) : (
              <div>
                <h1 
                  className="text-xl text-muted-foreground cursor-text"
                  onClick={() => {
                    setIsInputMode(true)
                    setPopoverOpen(true)  // Popoverも同時に開く
                  }}
                >
                  What are you working on?
                </h1>
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          {renderCommandContent()}
        </PopoverContent>
      </Popover>
    )
  }
)

TimerTaskDisplay.displayName = 'TimerTaskDisplay'
