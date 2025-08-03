'use client'

import { useState, forwardRef, useImperativeHandle } from 'react'
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
import { Zap } from 'lucide-react'
import { format } from 'date-fns'

interface TimerTaskDisplayProps {
  smallTasks: SmallTask[]
  projects: Project[]
  dayTasks: SmallTask[]
  onUnplannedTaskClick: () => void
  onTaskChange?: (task: SmallTask) => Promise<void>
}

export interface TimerTaskDisplayRef {
  openPopover: () => void
}

export const TimerTaskDisplay = forwardRef<TimerTaskDisplayRef, TimerTaskDisplayProps>(
  ({ smallTasks, projects, dayTasks, onUnplannedTaskClick, onTaskChange }, ref) => {
    const { currentTask, currentProject, setCurrentTask, setCurrentProject } = useTimerStore()
    const [popoverOpen, setPopoverOpen] = useState(false)

    useImperativeHandle(ref, () => ({
      openPopover: () => setPopoverOpen(true),
    }))

    const getProjectForTask = (task: SmallTask): Project | undefined => {
      return task.task_type !== 'routine' ? projects.find(p => p.id === task.project_id) : undefined
    }

    const handleTaskSelect = (value: string) => {
      if (value === 'unplanned') {
        onUnplannedTaskClick()
        setPopoverOpen(false)
      } else {
        const task = smallTasks.find(t => t.id === value)
        if (task) {
          setCurrentTask(task)
          const project = getProjectForTask(task)
          setCurrentProject(project || null)

          if (onTaskChange) {
            onTaskChange(task).catch(error => {
              console.error('Failed to change task:', error)
            })
          }
          setPopoverOpen(false)
        }
      }
    }

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
                  <p className="text-sm text-muted-foreground">ルーチンタスク</p>
                ) : currentProject ? (
                  <p className="text-sm text-muted-foreground">{currentProject.name}</p>
                ) : null}
              </div>
            ) : (
              <div>
                <h1 className="text-xl text-muted-foreground">What are you working on?</h1>
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search" />
            <CommandEmpty>No task found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="unplanned" onSelect={handleTaskSelect}>
                <Zap className="mr-2 h-4 w-4" />
                <span>Unplanned work...</span>
              </CommandItem>
              {smallTasks
                .sort((a, b) => {
                  const aIsToday = dayTasks.some(t => t.id === a.id)
                  const bIsToday = dayTasks.some(t => t.id === b.id)
                  if (aIsToday && !bIsToday) return -1
                  if (!aIsToday && bIsToday) return 1
                  return a.name.localeCompare(b.name)
                })
                .map(task => {
                  const project = getProjectForTask(task)
                  const isToday = dayTasks.some(t => t.id === task.id)
                  return (
                    <CommandItem key={task.id} value={task.id} onSelect={handleTaskSelect}>
                      <div className="flex items-center gap-2 flex-1">
                        <span className={!isToday ? 'text-muted-foreground' : ''}>
                          {task.task_type === 'routine' && <span className="opacity-60">⚡ </span>}
                          {task.name}
                        </span>
                        {task.task_type === 'routine' ? (
                          <Badge variant="outline" className="text-xs">
                            ルーチン
                          </Badge>
                        ) : project ? (
                          <Badge variant={isToday ? 'secondary' : 'outline'} className="text-xs">
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
        </PopoverContent>
      </Popover>
    )
  }
)

TimerTaskDisplay.displayName = 'TimerTaskDisplay'
