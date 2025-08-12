'use client'

import { KanbanBoard } from '@/components/kanban/kanban-board'
import { KanbanFilterPanel } from '@/components/kanban/kanban-filter-panel'
import { useQuery } from '@tanstack/react-query'
import { projectRepository, smallTaskRepository, bigTaskRepository } from '@/lib/db/repositories'
import { Loader2 } from 'lucide-react'
import { useMemo, useEffect } from 'react'
import { useKanbanFilterStore } from '@/stores/kanban-filter-store'
import { BigTask } from '@/types'

export default function KanbanPage() {
  const userId = 'current-user' // TODO: 認証システム実装後に実際のユーザーIDに置き換え
  // useKanbanFiltersは使用しないので削除可能
  const { filters, selectedBigTaskIds, selectAllBigTasks } = useKanbanFilterStore()

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', userId],
    queryFn: async () => {
      if (!userId) return []
      return await projectRepository.getActiveProjects(userId)
    },
    enabled: !!userId,
  })

  const { data: allBigTasks, isLoading: isLoadingBigTasks } = useQuery({
    queryKey: ['kanban-big-tasks', userId],
    queryFn: async () => {
      if (!userId || !projects) return []
      const bigTasksList = []
      for (const project of projects) {
        const projectBigTasks = await bigTaskRepository.getByProjectId(project.id)
        // 全てのステータスのBigTaskを取得
        bigTasksList.push(...projectBigTasks)
      }
      // orderフィールドでソート、orderがない場合は配列の順序を保持
      return bigTasksList.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order
        }
        if (a.order !== undefined) return -1
        if (b.order !== undefined) return 1
        return 0
      })
    },
    enabled: !!userId && !!projects && projects.length > 0,
  })

  const { data: allTasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['kanban-tasks', userId, allBigTasks],
    queryFn: async () => {
      if (!userId || !allBigTasks) return []
      const tasksList = []
      // 全てのBigTaskに対してSmallTaskを取得
      for (const bigTask of allBigTasks) {
        const bigTaskTasks = await smallTaskRepository.getByBigTaskId(bigTask.id)
        tasksList.push(...bigTaskTasks)
      }
      return tasksList
    },
    enabled: !!userId && !!allBigTasks && allBigTasks.length > 0,
  })

  const isLoading = isLoadingProjects || isLoadingBigTasks || isLoadingTasks
  
  // 初回読み込み時に「その他」以外かつ3日以内に開始するBigTaskを選択
  useEffect(() => {
    if (allBigTasks && allBigTasks.length > 0 && selectedBigTaskIds.size === 0) {
      const today = new Date()
      const threeDaysLater = new Date()
      threeDaysLater.setDate(today.getDate() + 3)
      
      // 表示対象のBigTaskをフィルタリング
      const visibleTaskIds = allBigTasks
        .filter(bt => {
          // 「その他」を除外
          if (bt.name === 'その他') return false
          
          // 開始日が3日後以降のものを除外
          if (bt.start_date) {
            const startDate = new Date(bt.start_date)
            if (startDate >= threeDaysLater) return false
          }
          
          return true
        })
        .map(bt => bt.id)
      
      // 表示対象が存在する場合のみ選択
      if (visibleTaskIds.length > 0) {
        selectAllBigTasks(visibleTaskIds)
      }
    }
  }, [allBigTasks, selectedBigTaskIds.size, selectAllBigTasks])

  // ステータスフィルターを適用した大タスク（大タスク表示セクション用）
  const bigTasksForDisplay = useMemo(() => {
    if (!allBigTasks) return []
    return allBigTasks.filter(bigTask => 
      filters.status[bigTask.status as keyof typeof filters.status]
    )
  }, [allBigTasks, filters])
  
  // ステータスフィルターの配列化
  const bigTaskStatusFilter = useMemo(() => {
    const statuses: Array<BigTask['status']> = []
    if (filters.status.active) statuses.push('active')
    if (filters.status.completed) statuses.push('completed') 
    if (filters.status.cancelled) statuses.push('cancelled')
    return statuses
  }, [filters.status])

  // 全カテゴリーを抽出（フィルターパネル用）
  const allCategories = useMemo(() => {
    if (!allBigTasks) return []
    const categories = new Set<string>()
    allBigTasks.forEach(bt => {
      if (bt.category) categories.add(bt.category)
    })
    return Array.from(categories).sort()
  }, [allBigTasks])

  if (!userId || isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 bg-muted/30">
      <KanbanFilterPanel 
        bigTasks={bigTasksForDisplay || []} 
        projects={projects || []}
        allCategories={allCategories} 
      />
      
      <KanbanBoard
        projects={projects || []}
        bigTasks={allBigTasks || []}
        tasks={allTasks || []}
        userId={userId}
        onTasksChange={refetchTasks}
        bigTaskStatusFilter={bigTaskStatusFilter}
        selectedBigTaskIds={Array.from(selectedBigTaskIds)}
      />
    </div>
  )
}
