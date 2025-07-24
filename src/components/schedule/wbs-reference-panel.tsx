/**
 * WBSReferencePanel - WBS参照パネル
 * 今週・来週のBigTaskを表示し、進捗状況を確認
 */

import { useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { BigTask, Project, SmallTask } from '@/types'
import { format, startOfWeek, endOfWeek, differenceInDays, addWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface WBSReferencePanelProps {
  currentWeekBigTasks: BigTask[]
  nextWeekBigTasks: BigTask[]
  projects: Project[]
  currentWeek?: Date
  smallTasks?: SmallTask[]
}

export function WBSReferencePanel({
  currentWeekBigTasks,
  nextWeekBigTasks,
  projects,
  currentWeek = new Date(),
  smallTasks = [],
}: WBSReferencePanelProps) {
  // 詳細なデバッグ情報
  useEffect(() => {
    console.log('=== WBS参照パネル デバッグ情報 ===')
    console.log('現在の週:', format(currentWeek, 'yyyy-MM-dd (E)', { locale: ja }))
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    console.log('週の範囲:', format(weekStart, 'MM/dd') + ' - ' + format(weekEnd, 'MM/dd'))
    console.log('プロジェクト数:', projects.length)
    console.log('今週のBigTask数:', currentWeekBigTasks.length)
    console.log('来週のBigTask数:', nextWeekBigTasks.length)

    // ID重複チェック
    console.log('\n=== ID重複チェック ===')

    // 今週のタスク内での重複
    const currentWeekIds = currentWeekBigTasks.map(t => t.id)
    const duplicateInCurrent = currentWeekIds.filter(
      (id, index) => currentWeekIds.indexOf(id) !== index
    )
    if (duplicateInCurrent.length > 0) {
      console.error('今週のタスク内で重複しているID:', duplicateInCurrent)
      duplicateInCurrent.forEach(id => {
        const tasks = currentWeekBigTasks.filter(t => t.id === id)
        console.error('重複タスク詳細:', tasks)
      })
    }

    // 来週のタスク内での重複
    const nextWeekIds = nextWeekBigTasks.map(t => t.id)
    const duplicateInNext = nextWeekIds.filter((id, index) => nextWeekIds.indexOf(id) !== index)
    if (duplicateInNext.length > 0) {
      console.error('来週のタスク内で重複しているID:', duplicateInNext)
      duplicateInNext.forEach(id => {
        const tasks = nextWeekBigTasks.filter(t => t.id === id)
        console.error('重複タスク詳細:', tasks)
      })
    }

    // 今週と来週の間での重複
    const commonIds = currentWeekIds.filter(id => nextWeekIds.includes(id))
    if (commonIds.length > 0) {
      console.warn('今週と来週の両方に存在するタスクID:', commonIds)
      commonIds.forEach(id => {
        const currentTask = currentWeekBigTasks.find(t => t.id === id)
        const nextTask = nextWeekBigTasks.find(t => t.id === id)
        console.warn('重複タスク（今週）:', currentTask)
        console.warn('重複タスク（来週）:', nextTask)
      })
    }

    // 全タスクのID一覧
    const allIds = [...currentWeekIds, ...nextWeekIds]
    const uniqueIds = new Set(allIds)
    console.log(`全タスクID数: ${allIds.length}, ユニークID数: ${uniqueIds.size}`)
    if (allIds.length !== uniqueIds.size) {
      console.error(`重複があります！ 重複数: ${allIds.length - uniqueIds.size}`)
    }

    // 各BigTaskの詳細情報
    console.log('\n=== 今週のタスク ===')
    currentWeekBigTasks.forEach(task => {
      const project = projects.find(p => p.id === task.project_id)
      console.log(`- ${task.name}`)
      console.log(`  プロジェクト: ${project?.name || '不明'}`)
      console.log(`  week_number: ${task.week_number}`)
      console.log(`  予定時間: ${task.estimated_hours}h`)
    })

    console.log('\n=== 来週のタスク ===')
    nextWeekBigTasks.forEach(task => {
      const project = projects.find(p => p.id === task.project_id)
      console.log(`- ${task.name}`)
      console.log(`  プロジェクト: ${project?.name || '不明'}`)
      console.log(`  week_number: ${task.week_number}`)
      console.log(`  予定時間: ${task.estimated_hours}h`)
    })

    console.log('\n=== 全プロジェクト情報 ===')
    projects.forEach(project => {
      console.log(`\nプロジェクト: ${project.name}`)
      console.log(`  ID: ${project.id}`)
      console.log(`  作成日: ${project.created_at}`)
    })
  }, [projects, currentWeekBigTasks, nextWeekBigTasks, currentWeek])

  // Calculate task progress based on small tasks
  const calculateProgress = (task: BigTask): number => {
    const taskSmallTasks = smallTasks.filter(st => st.big_task_id === task.id)
    if (taskSmallTasks.length === 0) return 0

    const completedTasks = taskSmallTasks.filter(st => st.status === 'completed')
    return Math.round((completedTasks.length / taskSmallTasks.length) * 100)
  }

  // Calculate variance based on actual vs estimated hours
  const calculateVariance = (task: BigTask): number => {
    const taskSmallTasks = smallTasks.filter(st => st.big_task_id === task.id)
    const totalEstimated =
      taskSmallTasks.reduce((sum, st) => sum + (st.estimated_minutes || 0), 0) / 60
    const totalActual = taskSmallTasks.reduce((sum, st) => sum + (st.actual_minutes || 0), 0) / 60

    if (totalEstimated === 0) return 0
    return totalActual - totalEstimated
  }

  // Get project name
  const getProjectName = (projectId: string): string => {
    const project = projects.find(p => p.id === projectId)

    // デバッグ: プロジェクトが見つからない場合
    if (!project) {
      console.warn(`Project not found for ID: ${projectId}`)
      console.warn(
        'Available projects:',
        projects.map(p => ({ id: p.id, name: p.name }))
      )
    }

    return project?.name || `不明なプロジェクト (ID: ${projectId})`
  }

  // Get status badge variant
  const getStatusVariant = (status: BigTask['status']) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'active':
        return 'secondary'
      case 'pending':
        return 'outline'
      default:
        return 'outline'
    }
  }

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const projectMap = new Map<
      string,
      {
        project: Project | undefined
        currentWeekTasks: BigTask[]
        nextWeekTasks: BigTask[]
      }
    >()

    // Initialize with all projects
    projects.forEach(project => {
      projectMap.set(project.id, {
        project,
        currentWeekTasks: [],
        nextWeekTasks: [],
      })
    })

    // Group current week tasks
    currentWeekBigTasks.forEach(task => {
      const existing = projectMap.get(task.project_id)
      if (existing) {
        existing.currentWeekTasks.push(task)
      } else {
        projectMap.set(task.project_id, {
          project: projects.find(p => p.id === task.project_id),
          currentWeekTasks: [task],
          nextWeekTasks: [],
        })
      }
    })

    // Group next week tasks
    nextWeekBigTasks.forEach(task => {
      const existing = projectMap.get(task.project_id)
      if (existing) {
        existing.nextWeekTasks.push(task)
      } else {
        projectMap.set(task.project_id, {
          project: projects.find(p => p.id === task.project_id),
          currentWeekTasks: [],
          nextWeekTasks: [task],
        })
      }
    })

    // Convert to array and filter out projects with no tasks
    return Array.from(projectMap.values())
      .filter(item => item.currentWeekTasks.length > 0 || item.nextWeekTasks.length > 0)
      .sort((a, b) => {
        // Sort by project name
        const nameA = a.project?.name || ''
        const nameB = b.project?.name || ''
        return nameA.localeCompare(nameB)
      })
  }, [projects, currentWeekBigTasks, nextWeekBigTasks])

  return (
    <>
      <CardHeader className="pb-3 px-6">
        <CardTitle className="flex items-center gap-2 text-[#1C1C14]">
          <Calendar className="h-5 w-5 text-[#5E621B]" />
          WBS参照
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        <ScrollArea className="h-full max-h-[250px]">
          <div className="space-y-6">
            {/* Week Range Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#47473B] flex items-center gap-2">
                今週: {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'M/d')} -{' '}
                {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'M/d')}
              </h3>
              <h3 className="text-sm font-semibold text-[#47473B] flex items-center gap-2">
                来週: {format(startOfWeek(addWeeks(currentWeek, 1), { weekStartsOn: 1 }), 'M/d')} -{' '}
                {format(endOfWeek(addWeeks(currentWeek, 1), { weekStartsOn: 1 }), 'M/d')}
              </h3>
            </div>

            {/* Projects Tables */}
            {tasksByProject.length === 0 ? (
              <p className="text-sm text-[#47473B] text-center py-4">タスクがありません</p>
            ) : (
              tasksByProject.map(({ project, currentWeekTasks, nextWeekTasks }) => {
                const projectName = project?.name || '不明なプロジェクト'

                return (
                  <div key={project?.id || 'unknown'} className="space-y-2">
                    {/* Project Header */}
                    <h4 className="font-medium text-sm text-[#1C1C14] bg-[#E4E5C0] px-3 py-1.5 rounded">
                      {projectName}
                    </h4>

                    {/* Table */}
                    <div className="overflow-hidden rounded-lg border border-[#D4D2C1]">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F5F3E2] text-xs">
                            <th className="text-left px-3 py-2 font-medium text-[#47473B] w-2/5">
                              タスク名
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-[#47473B] w-1/6">
                              カテゴリ
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-[#47473B] w-1/12">
                              時間
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-[#47473B] w-1/12">
                              進捗
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-[#47473B] w-1/6">
                              ステータス
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Current Week Tasks */}
                          {currentWeekTasks.length > 0 && (
                            <>
                              <tr>
                                <td
                                  colSpan={5}
                                  className="bg-[#E3E892] px-3 py-1 text-xs font-medium text-[#464A02]"
                                >
                                  今週
                                </td>
                              </tr>
                              {currentWeekTasks.map(task => {
                                const progress = calculateProgress(task)

                                return (
                                  <tr
                                    key={`current-${task.id}`}
                                    className="border-t border-[#E5E3D2] hover:bg-[#FCFAEC]"
                                  >
                                    <td className="px-3 py-2 text-sm text-[#1C1C14]">
                                      {task.name}
                                    </td>
                                    <td className="px-3 py-2">
                                      {task.category && (
                                        <Badge className="text-xs bg-[#BEECDB] text-[#244E42] border-[#AEECCB]">
                                          {task.category}
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="text-center px-3 py-2 text-sm text-[#47473B]">
                                      {task.estimated_hours}h
                                    </td>
                                    <td className="text-center px-3 py-2">
                                      <div className="flex items-center justify-center gap-1">
                                        <Progress value={progress} className="w-12 h-1.5" />
                                        <span className="text-xs text-[#47473B]">{progress}%</span>
                                      </div>
                                    </td>
                                    <td className="text-center px-3 py-2">
                                      <Badge
                                        variant={getStatusVariant(task.status)}
                                        className={cn(
                                          'text-xs',
                                          task.status === 'completed'
                                            ? 'bg-[#BEECDB] text-[#244E42]'
                                            : task.status === 'active'
                                              ? 'bg-[#E3E892] text-[#464A02]'
                                              : 'bg-[#E4E5C0] text-[#47492E]'
                                        )}
                                      >
                                        {task.status === 'completed'
                                          ? '完了'
                                          : task.status === 'active'
                                            ? '進行中'
                                            : '未着手'}
                                      </Badge>
                                    </td>
                                  </tr>
                                )
                              })}
                            </>
                          )}

                          {/* Next Week Tasks */}
                          {nextWeekTasks.length > 0 && (
                            <>
                              <tr>
                                <td
                                  colSpan={5}
                                  className="bg-[#E4E5C0] px-3 py-1 text-xs font-medium text-[#47492E]"
                                >
                                  来週
                                </td>
                              </tr>
                              {nextWeekTasks.map(task => (
                                <tr
                                  key={`next-${task.id}`}
                                  className="border-t border-[#E5E3D2] hover:bg-[#FCFAEC]"
                                >
                                  <td className="px-3 py-2 text-sm text-[#1C1C14]">{task.name}</td>
                                  <td className="px-3 py-2">
                                    {task.category && (
                                      <Badge className="text-xs bg-[#BEECDB] text-[#244E42] border-[#AEECCB]">
                                        {task.category}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="text-center px-3 py-2 text-sm text-[#47473B]">
                                    {task.estimated_hours}h
                                  </td>
                                  <td className="text-center px-3 py-2 text-xs text-[#7B7D5F]">
                                    -
                                  </td>
                                  <td className="text-center px-3 py-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-[#E4E5C0] text-[#47492E]"
                                    >
                                      予定
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}

            {/* プロジェクトが登録されていない場合 */}
            {projects.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[#47473B] mb-2">プロジェクトが登録されていません</p>
                <p className="text-sm text-[#47473B]">
                  /projects/new からプロジェクトを作成してください
                </p>
              </div>
            )}

            {/* デバッグ用: 全BigTaskのリスト */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs">
                <h4 className="font-bold mb-2">デバッグ情報</h4>
                <p>
                  現在の週: {format(currentWeek, 'yyyy-MM-dd')} (
                  {format(currentWeek, 'E', { locale: ja })})
                </p>
                <p>
                  週の範囲: {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MM/dd')} -{' '}
                  {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MM/dd')}
                </p>
                <p>全BigTask数: {currentWeekBigTasks.length + nextWeekBigTasks.length}</p>

                {/* 週番号マッピング */}
                <details className="mt-2">
                  <summary className="cursor-pointer">プロジェクトごとの週番号マッピング</summary>
                  <div className="mt-2 space-y-2">
                    {projects.map(project => {
                      const projectStart = new Date(project.created_at)
                      const projectWeekStart = startOfWeek(projectStart, { weekStartsOn: 1 })
                      const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
                      const diffWeeks = Math.floor(
                        (currentWeekStart.getTime() - projectWeekStart.getTime()) /
                          (7 * 24 * 60 * 60 * 1000)
                      )
                      const currentWeekNumber = diffWeeks + 1

                      return (
                        <div key={project.id} className="border-b pb-2">
                          <div className="font-semibold">{project.name}</div>
                          <div className="pl-2">
                            <div>
                              作成日: {format(projectStart, 'yyyy-MM-dd (E)', { locale: ja })}
                            </div>
                            <div>第1週: {format(projectWeekStart, 'MM/dd')} -</div>
                            <div>現在表示中: 第{currentWeekNumber}週</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>

                <details className="mt-2">
                  <summary className="cursor-pointer">全BigTaskの詳細</summary>
                  <div className="mt-2 space-y-1">
                    {[...currentWeekBigTasks, ...nextWeekBigTasks].map((task, index) => (
                      <div key={`debug-${index}-${task.id}`} className="pl-4">
                        - {task.name} (week: {task.week_number}, project:{' '}
                        {getProjectName(task.project_id)})
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </>
  )
}
