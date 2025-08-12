'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import { TaskEditModal } from './task-edit-modal'
import { TaskDeleteConfirm } from './task-delete-confirm'
import { Button } from '@/components/ui/button'
import { Project, BigTask, SmallTask, CreateSmallTaskData, UpdateSmallTaskData } from '@/types'
import { smallTaskRepository, bigTaskRepository } from '@/lib/db/repositories'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import Link from 'next/link'

interface KanbanBoardProps {
  projects: Project[]
  bigTasks: BigTask[]
  tasks: SmallTask[]
  userId: string
  onTasksChange: () => void
  bigTaskStatusFilter?: Array<BigTask['status']>  // ステータスフィルター
  selectedBigTaskIds?: string[]                   // 選択されたBigTask ID
}

export function KanbanBoard({ 
  projects, 
  bigTasks, 
  tasks, 
  userId, 
  onTasksChange,
  bigTaskStatusFilter,
  selectedBigTaskIds 
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<SmallTask | null>(null)
  const [deletingTask, setDeletingTask] = useState<SmallTask | null>(null)

  // ステータスと選択状態でフィルタリング
  const shownBigTasks = useMemo(() => {
    let filtered = bigTasks
    
    // ステータスフィルター
    if (bigTaskStatusFilter?.length) {
      const statusSet = new Set(bigTaskStatusFilter)
      filtered = filtered.filter(bt => statusSet.has(bt.status))
    }
    
    // 選択フィルター
    if (selectedBigTaskIds?.length) {
      filtered = filtered.filter(bt => selectedBigTaskIds.includes(bt.id))
    }
    
    return filtered
  }, [bigTasks, bigTaskStatusFilter, selectedBigTaskIds])

  // ドラッグ&ドロップのセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // タスクを表示対象BigTaskごとに整理
  const tasksByBigTask = shownBigTasks.reduce((acc, bigTask) => {
    acc[bigTask.id] = tasks
      .filter(task => task.big_task_id === bigTask.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    return acc
  }, {} as Record<string, SmallTask[]>)

  // BigTaskからプロジェクトを取得するヘルパー関数
  const getProjectForBigTask = (bigTask: BigTask): Project | undefined => {
    return projects.find(p => p.id === bigTask.project_id)
  }

  // タスク作成のミューテーション
  const createTaskMutation = useMutation({
    mutationFn: async (data: CreateSmallTaskData) => {
      return await smallTaskRepository.create(data)
    },
    onSuccess: () => {
      toast.success('タスクを作成しました')
      onTasksChange()
    },
    onError: (error) => {
      toast.error(`タスクの作成に失敗しました: ${error.message}`)
    },
  })

  // タスク更新のミューテーション
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSmallTaskData }) => {
      return await smallTaskRepository.update(id, data)
    },
    onSuccess: () => {
      toast.success('タスクを更新しました')
      onTasksChange()
      setEditingTask(null)
    },
    onError: (error) => {
      toast.error(`タスクの更新に失敗しました: ${error.message}`)
    },
  })

  // タスク削除のミューテーション
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await smallTaskRepository.delete(taskId)
    },
    onSuccess: () => {
      toast.success('タスクを削除しました')
      onTasksChange()
      setDeletingTask(null)
    },
    onError: (error) => {
      toast.error(`タスクの削除に失敗しました: ${error.message}`)
    },
  })

  // タスクの並び順更新のミューテーション
  const reorderTasksMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; order: number }>) => {
      return await smallTaskRepository.reorderTasks(updates)
    },
    onSuccess: () => {
      onTasksChange()
    },
    onError: (error) => {
      toast.error(`タスクの並び替えに失敗しました: ${error.message}`)
      onTasksChange() // エラー時もデータを再取得してロールバック
    },
  })

  // BigTaskの並び順更新のミューテーション
  const reorderBigTasksMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; order: number }>) => {
      return await bigTaskRepository.reorderBigTasks(updates)
    },
    onSuccess: () => {
      onTasksChange()
    },
    onError: (error) => {
      toast.error(`カラムの並び替えに失敗しました: ${error.message}`)
      onTasksChange()
    },
  })

  // タスクの列移動のミューテーション
  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, bigTaskId, order }: { taskId: string; bigTaskId: string; order: number }) => {
      const bigTask = shownBigTasks.find(bt => bt.id === bigTaskId)
      await smallTaskRepository.update(taskId, { 
        big_task_id: bigTaskId,
        project_id: bigTask?.project_id,
        order,
        kanban_column: bigTaskId 
      })
    },
    onSuccess: () => {
      onTasksChange()
    },
    onError: (error) => {
      toast.error(`タスクの移動に失敗しました: ${error.message}`)
      onTasksChange()
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    // カラム（BigTask）のドラッグ&ドロップ処理
    if (active.data.current?.type === 'column') {
      const activeBigTask = shownBigTasks.find(bt => bt.id === active.id)
      const overBigTask = shownBigTasks.find(bt => bt.id === over.id)
      
      if (activeBigTask && overBigTask && active.id !== over.id) {
        const oldIndex = shownBigTasks.findIndex(bt => bt.id === active.id)
        const newIndex = shownBigTasks.findIndex(bt => bt.id === over.id)
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newBigTasks = arrayMove(shownBigTasks, oldIndex, newIndex)
          // 表示中のBigTaskのみを連番で更新
          const updates = newBigTasks.map((bigTask, index) => ({
            id: bigTask.id,
            order: index,
          }))
          reorderBigTasksMutation.mutate(updates)
        }
      }
      setActiveId(null)
      return
    }

    // タスク（SmallTask）のドラッグ&ドロップ処理
    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) {
      setActiveId(null)
      return
    }

    // どの列（BigTask）にドロップされたか判定
    const overBigTaskId = over.data.current?.bigTaskId || over.id as string
    const activeBigTaskId = activeTask.big_task_id

    if (activeBigTaskId === overBigTaskId) {
      // 同じ列内での並び替え
      const bigTaskTasks = tasksByBigTask[overBigTaskId] || []
      const oldIndex = bigTaskTasks.findIndex((t: SmallTask) => t.id === active.id)
      const newIndex = bigTaskTasks.findIndex((t: SmallTask) => t.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newTasks = arrayMove(bigTaskTasks, oldIndex, newIndex)
        const updates = newTasks.map((task: SmallTask, index: number) => ({
          id: task.id,
          order: index,
        }))
        reorderTasksMutation.mutate(updates)
      }
    } else {
      // 別の列への移動
      const targetBigTaskTasks = tasksByBigTask[overBigTaskId] || []
      const newOrder = targetBigTaskTasks.length

      moveTaskMutation.mutate({
        taskId: activeTask.id,
        bigTaskId: overBigTaskId,
        order: newOrder,
      })
    }

    setActiveId(null)
  }

  const handleCreateTask = async (bigTaskId: string, title: string) => {
    const bigTaskTasks = tasksByBigTask[bigTaskId] || []
    const newOrder = bigTaskTasks.length
    const bigTask = bigTasks.find(bt => bt.id === bigTaskId)
    
    const data: CreateSmallTaskData = {
      name: title,
      user_id: userId,
      project_id: bigTask?.project_id || '',
      big_task_id: bigTaskId,
      estimated_minutes: 30, // デフォルト30分の見積もり
      scheduled_start: null, // 未スケジュール
      scheduled_end: null, // 未スケジュール
      status: 'pending',
      order: newOrder,
      kanban_column: bigTaskId, // カンバンで作成されたことを示す
    }
    
    return new Promise<void>((resolve, reject) => {
      createTaskMutation.mutate(data, {
        onSuccess: () => resolve(),
        onError: (error) => reject(error),
      })
    })
  }

  const handleUpdateTask = (task: SmallTask, data: UpdateSmallTaskData) => {
    updateTaskMutation.mutate({ id: task.id, data })
  }

  const handleDeleteTask = (task: SmallTask) => {
    deleteTaskMutation.mutate(task.id)
  }

  // 大タスク完了のミューテーション
  const completeBigTaskMutation = useMutation({
    mutationFn: async (bigTaskId: string) => {
      return await bigTaskRepository.update(bigTaskId, { status: 'completed' })
    },
    onSuccess: () => {
      toast.success('大タスクを完了しました')
      onTasksChange()
    },
    onError: (error) => {
      toast.error(`大タスクの完了に失敗しました: ${error.message}`)
    },
  })

  const handleCompleteBigTask = (bigTaskId: string) => {
    // 確認ダイアログを表示してから完了処理
    if (window.confirm('この大タスクを完了にしますか？')) {
      completeBigTaskMutation.mutate(bigTaskId)
    }
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null
  const activeBigTask = activeId ? shownBigTasks.find(bt => bt.id === activeId) : null

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted/30 scrollbar-track-transparent hover:scrollbar-thumb-muted/50">
          <SortableContext
            items={shownBigTasks.map(bt => bt.id)}
            strategy={horizontalListSortingStrategy}
          >
            {shownBigTasks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
                表示対象の大タスクがありません
              </div>
            ) : (
              shownBigTasks.map(bigTask => {
              const project = getProjectForBigTask(bigTask)
              return (
                <KanbanColumn
                  key={bigTask.id}
                  bigTask={bigTask}
                  project={project}
                  tasks={tasksByBigTask[bigTask.id] || []}
                  onCreateTask={(title) => handleCreateTask(bigTask.id, title)}
                  onEditTask={setEditingTask}
                  onDeleteTask={setDeletingTask}
                  onCompleteBigTask={handleCompleteBigTask}
                />
              )
            })
            )}
          </SortableContext>
          
          {shownBigTasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="mb-4">アクティブな大タスクがありません</p>
                <Button variant="outline" asChild>
                  <Link href="/projects">プロジェクト管理へ</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeTask && (
            <KanbanCard 
              task={activeTask} 
              projectColor={projects.find(p => p.id === activeTask.project_id)?.color}
              isDragging 
            />
          )}
          {activeBigTask && (
            <div className="opacity-90 pointer-events-none shadow-2xl">
              <KanbanColumn
                bigTask={activeBigTask}
                project={projects.find(p => p.id === activeBigTask.project_id)}
                tasks={tasksByBigTask[activeBigTask.id] || []}
                onCreateTask={async () => {}}
                onEditTask={() => {}}
                onDeleteTask={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* タスク編集モーダル */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          projectId={editingTask.project_id || ''}
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(data) => handleUpdateTask(editingTask, data)}
        />
      )}

      {/* タスク削除確認ダイアログ */}
      {deletingTask && (
        <TaskDeleteConfirm
          task={deletingTask}
          open={!!deletingTask}
          onClose={() => setDeletingTask(null)}
          onConfirm={() => handleDeleteTask(deletingTask)}
        />
      )}
    </>
  )
}