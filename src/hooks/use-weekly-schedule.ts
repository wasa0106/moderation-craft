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

  // 作成・更新・削除用のフック
  const { createSmallTask, updateSmallTask, deleteSmallTask, rescheduleTask } =
    useSmallTasks(userId)

  // Also get all small tasks for progress calculation
  const { smallTasks: allSmallTasks } = useSmallTasks(userId)

  // Filter projects and big tasks
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'active')
  }, [projects])

  // Calculate week number based on project start date
  const calculateWeekNumber = (projectId: string, targetDate: Date): number => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return 1

    const projectDate = new Date(project.created_at)

    // 8月のプロジェクトの特別処理（2025年8月）
    if (projectDate.getMonth() === 7 && projectDate.getFullYear() === 2025) {
      const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 })
      const dateStr = format(targetWeekStart, 'yyyy-MM-dd')

      // プロジェクト作成画面での週配分に基づくマッピング
      const weekMap: Record<string, number> = {
        '2025-07-28': 1, // 7/28-8/3 (第1週)
        '2025-08-04': 2, // 8/4-8/10 (第2週)
        '2025-08-11': 3, // 8/11-8/17 (第3週)
        '2025-08-18': 4, // 8/18-8/24 (第4週)
        '2025-08-25': 5, // 8/25-8/31 (第5週)
      }

      const weekNumber = weekMap[dateStr]
      if (weekNumber) {
        console.log(`8月プロジェクト "${project.name}" 週番号: ${dateStr} → 第${weekNumber}週`)
        return weekNumber
      }
    }

    // その他のプロジェクトは既存のロジック
    const projectStart = new Date(project.created_at)

    // 両方を月曜日に正規化して週番号を計算
    const startOfProjectWeek = startOfWeek(projectStart, { weekStartsOn: 1 })
    const startOfTargetWeek = startOfWeek(targetDate, { weekStartsOn: 1 })

    // 週の差分を計算
    const diffInMs = startOfTargetWeek.getTime() - startOfProjectWeek.getTime()
    const diffInWeeks = Math.floor(diffInMs / (7 * 24 * 60 * 60 * 1000))

    // デバッグ情報
    console.log(`Week calculation for project ${project.name}:`, {
      projectCreated: format(projectStart, 'yyyy-MM-dd (E)', { locale: ja }),
      projectWeekStart: format(startOfProjectWeek, 'yyyy-MM-dd (E)', { locale: ja }),
      targetWeek: format(targetDate, 'yyyy-MM-dd (E)', { locale: ja }),
      targetWeekStart: format(startOfTargetWeek, 'yyyy-MM-dd (E)', { locale: ja }),
      diffInWeeks,
      calculatedWeekNumber: diffInWeeks + 1,
    })

    return diffInWeeks + 1 // Week numbers start from 1
  }

  const currentWeekBigTasks = useMemo(() => {
    if (projects.length === 0) return []

    console.log('=== Filtering Current Week Tasks ===')
    console.log('Selected Week:', format(selectedWeek, 'yyyy-MM-dd (E)', { locale: ja }))

    // 存在するプロジェクトIDのセットを作成
    const existingProjectIds = new Set(projects.map(p => p.id))

    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })

    // まず日付範囲でフィルタリングを試みる
    const tasksWithDateRange = bigTasks.filter(task => task.week_start_date && task.week_end_date)

    if (tasksWithDateRange.length > 0) {
      console.log('Using date range filtering for tasks with week_start_date/week_end_date')
      const filtered = filterTasksByDateRange(bigTasks, weekStart)
        .filter(task => existingProjectIds.has(task.project_id)) // 存在するプロジェクトのタスクのみ
      const results = selectedProjectId
        ? filtered.filter(task => task.project_id === selectedProjectId)
        : filtered
      console.log(`Found ${results.length} tasks using date range filtering`)
      return results
    }

    // 日付範囲がない場合は従来のweek_numberベースのフィルタリング
    console.log('Falling back to week_number-based filtering')
    const results = bigTasks.filter(task => {
      // 存在しないプロジェクトのタスクを除外
      if (!existingProjectIds.has(task.project_id)) return false
      
      if (selectedProjectId && task.project_id !== selectedProjectId) return false

      const weekNumber = calculateWeekNumber(task.project_id, selectedWeek)
      return task.week_number === weekNumber
    })

    console.log(`Found ${results.length} tasks for current week`)
    return results
  }, [bigTasks, selectedWeek, selectedProjectId, projects])

  const nextWeekBigTasks = useMemo(() => {
    if (projects.length === 0) return []

    // 存在するプロジェクトIDのセットを作成
    const existingProjectIds = new Set(projects.map(p => p.id))

    const nextWeek = addWeeks(selectedWeek, 1)
    const nextWeekStart = startOfWeek(nextWeek, { weekStartsOn: 1 })

    // まず日付範囲でフィルタリングを試みる
    const tasksWithDateRange = bigTasks.filter(task => task.week_start_date && task.week_end_date)

    if (tasksWithDateRange.length > 0) {
      const filtered = filterTasksByDateRange(bigTasks, nextWeekStart)
        .filter(task => existingProjectIds.has(task.project_id)) // 存在するプロジェクトのタスクのみ
      const results = selectedProjectId
        ? filtered.filter(task => task.project_id === selectedProjectId)
        : filtered
      return results
    }

    // 日付範囲がない場合は従来のweek_numberベースのフィルタリング
    return bigTasks.filter(task => {
      // 存在しないプロジェクトのタスクを除外
      if (!existingProjectIds.has(task.project_id)) return false
      
      if (selectedProjectId && task.project_id !== selectedProjectId) return false

      const weekNumber = calculateWeekNumber(task.project_id, nextWeek)
      return task.week_number === weekNumber
    })
  }, [bigTasks, selectedWeek, selectedProjectId, projects])

  // Create schedule blocks from small tasks
  const scheduleBlocks = useMemo((): ScheduleBlock[] => {
    console.log('scheduleBlocks生成:', {
      weekStartStr,
      weekEndStr,
      weekTasksCount: weekTasks.length,
      scheduledTasksCount: weekTasks.filter(t => t.scheduled_start && t.scheduled_end).length
    })
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
          tags: task.tags || [],
          color: getProjectColor(
            task.project_id || '',
            activeProjects.findIndex(p => p.id === task.project_id)
          ),
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
    console.log('Copy previous week schedule - to be implemented')
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
