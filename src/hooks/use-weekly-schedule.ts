/**
 * useWeeklySchedule - Weekly schedule management hook
 * Provides data fetching and management for weekly schedule view
 */

import { useState, useMemo } from 'react'
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useProjects } from './use-projects'
import { useBigTasks } from './use-big-tasks'
import { useSmallTasks, useSmallTasksByDateRange } from './use-small-tasks'
import { filterTasksByDateRange } from '@/utils/date-range-utils'
import {
  SmallTask,
  CreateSmallTaskData,
  UpdateSmallTaskData,
  WeeklySchedule,
  ScheduleBlock,
} from '@/types'

export function useWeeklySchedule(userId: string, selectedWeek: Date) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Calculate week start and end dates
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }) // Sunday
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  // Fetch data
  const { projects, isLoading: projectsLoading } = useProjects(userId)
  const { bigTasks, isLoading: bigTasksLoading } = useBigTasks(userId)
  // useSmallTasksByDateRangeは読み取り専用なので、別途useSmallTasksを使用
  const { smallTasks: weekTasks, isLoading: tasksLoading } = useSmallTasksByDateRange(
    userId,
    weekStartStr,
    weekEndStr
  )

  // 作成・更新・削除用のフック（繰り返しタスク対応を含む）
  const { 
    createSmallTask, 
    updateSmallTask, 
    deleteSmallTask, 
    rescheduleTask,
    deleteRecurringTasks 
  } = useSmallTasks(userId)

  // Also get all small tasks for progress calculation
  const { smallTasks: allSmallTasks } = useSmallTasks(userId)

  // Filter projects and big tasks
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'active')
  }, [projects])

  const currentWeekBigTasks = useMemo(() => {
    if (projects.length === 0) return []

    // 存在するプロジェクトIDのセットを作成
    const existingProjectIds = new Set(projects.map(p => p.id))

    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })

    // 日付範囲でフィルタリング
    const filtered = filterTasksByDateRange(bigTasks, weekStart).filter(task =>
      existingProjectIds.has(task.project_id)
    ) // 存在するプロジェクトのタスクのみ

    const results = selectedProjectId
      ? filtered.filter(task => task.project_id === selectedProjectId)
      : filtered

    return results
  }, [bigTasks, selectedWeek, selectedProjectId, projects])

  const nextWeekBigTasks = useMemo(() => {
    if (projects.length === 0) return []

    // 存在するプロジェクトIDのセットを作成
    const existingProjectIds = new Set(projects.map(p => p.id))

    const nextWeek = addWeeks(selectedWeek, 1)
    const nextWeekStart = startOfWeek(nextWeek, { weekStartsOn: 1 })

    // 日付範囲でフィルタリング
    const filtered = filterTasksByDateRange(bigTasks, nextWeekStart).filter(task =>
      existingProjectIds.has(task.project_id)
    ) // 存在するプロジェクトのタスクのみ

    const results = selectedProjectId
      ? filtered.filter(task => task.project_id === selectedProjectId)
      : filtered

    return results
  }, [bigTasks, selectedWeek, selectedProjectId, projects])

  // Create schedule blocks from small tasks
  const scheduleBlocks = useMemo((): ScheduleBlock[] => {
    return weekTasks
      .filter(task => task.scheduled_start && task.scheduled_end)
      .map(task => {
        const project = projects.find(p => p.id === task.project_id)
        const bigTask = bigTasks.find(bt => bt.id === task.big_task_id)

        return {
          id: task.id,
          taskId: task.id,
          startTime: task.scheduled_start,
          endTime: task.scheduled_end,
          projectId: task.project_id || '',
          projectName: project?.name || '',
          taskName: task.name,
          color:
            project?.color ||
            getProjectColor(
              task.project_id || '',
              activeProjects.findIndex(p => p.id === task.project_id)
            ),
          isRecurring: !!task.recurrence_parent_id || !!task.recurrence_enabled,
        }
      })
  }, [weekTasks, projects, bigTasks, activeProjects])

  // Get unscheduled tasks
  const unscheduledTasks = useMemo(() => {
    return weekTasks.filter(task => !task.scheduled_start || !task.scheduled_end)
  }, [weekTasks])

  // Navigation functions (removed - will be handled by parent component)

  // Copy previous week schedule
  const copyPreviousWeekSchedule = async () => {
    // This would be implemented with a separate hook call
    // For now, we'll just show a placeholder
  }

  // Schedule/unschedule task
  const scheduleTask = async (taskId: string, startTime: string, endTime: string) => {
    await rescheduleTask({ id: taskId, newStartTime: startTime, newEndTime: endTime })
  }

  const unscheduleTask = async (taskId: string) => {
    await updateSmallTask({
      id: taskId,
      data: {
        scheduled_start: '',
        scheduled_end: '',
      },
    })
  }

  const weeklySchedule: WeeklySchedule = {
    weekStartDate: weekStartStr,
    weekEndDate: weekEndStr,
    scheduleBlocks,
    unscheduledTasks,
  }

  // Get scheduled tasks
  const scheduledTasks = useMemo(() => {
    return weekTasks.filter(task => task.scheduled_start && task.scheduled_end)
  }, [weekTasks])

  return {
    // Data
    weeklySchedule,
    scheduledTasks,
    projects: activeProjects,
    currentWeekBigTasks,
    nextWeekBigTasks,
    selectedWeek,
    selectedProjectId,
    allSmallTasks,

    // Loading states
    isLoading: projectsLoading || bigTasksLoading || tasksLoading,

    // Actions
    setSelectedProjectId,
    copyPreviousWeekSchedule,
    createSmallTask,
    updateSmallTask,
    deleteSmallTask,
    deleteRecurringTasks,
    scheduleTask,
    unscheduleTask,
  }
}

// Helper function to get project color
function getProjectColor(projectId: string, index: number): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#8B5CF6', // Purple
    '#F59E0B', // Orange
  ]

  return colors[index % colors.length] || colors[0]
}
