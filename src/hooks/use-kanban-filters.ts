import { useMemo } from 'react'
import { BigTask, SmallTask } from '@/types'
import { useKanbanFilterStore } from '@/stores/kanban-filter-store'

export function useKanbanFilters() {
  const { filters, isBigTaskVisible } = useKanbanFilterStore()
  
  const applyFilters = useMemo(() => {
    return (bigTasks: BigTask[], tasks: SmallTask[]) => {
      // BigTasksのフィルタリング
      let filteredBigTasks = bigTasks.filter(bigTask => {
        // 非表示設定されているBigTaskを除外
        if (!isBigTaskVisible(bigTask.id)) {
          return false
        }
        // ステータスフィルター
        if (!filters.status[bigTask.status as keyof typeof filters.status]) {
          return false
        }
        
        return true
      })
      
      // SmallTasksのフィルタリング（表示されているBigTaskに属するもののみ）
      const filteredTaskIds = new Set(filteredBigTasks.map(bt => bt.id))
      const filteredTasks = tasks.filter(task => 
        task.big_task_id && filteredTaskIds.has(task.big_task_id)
      )
      
      return {
        bigTasks: filteredBigTasks,
        tasks: filteredTasks
      }
    }
  }, [filters, isBigTaskVisible])
  
  return { applyFilters }
}