/**
 * SmallTaskInputPanel - 小タスク入力パネル
 * プロジェクトごとのタブ切り替え、表形式でのタスク管理
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Check, X, Edit2, Plus } from 'lucide-react'
import {
  Project,
  WeeklySchedule,
  CreateSmallTaskData,
  UpdateSmallTaskData,
  SmallTask,
} from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SmallTaskInputPanelProps {
  projects: Project[]
  selectedProjectId: string | null
  onProjectSelect: (projectId: string | null) => void
  weeklySchedule: WeeklySchedule
  onCreateTask: (data: CreateSmallTaskData) => Promise<SmallTask>
  onUpdateTask: (params: { id: string; data: UpdateSmallTaskData }) => Promise<SmallTask>
  onDeleteTask: (id: string) => Promise<void>
  generateTaskNo: (projectIndex: number, taskCount: number) => string
  userId: string
}

interface CellPosition {
  row: number
  col: number
}

const COLUMNS = [
  { key: 'taskNo', label: 'ID', width: '80px' },
  { key: 'name', label: 'タスク名', width: 'auto' },
  { key: 'estimatedMinutes', label: '見積時間', width: '100px' },
  { key: 'tags', label: 'タグ', width: '200px' },
  { key: 'actions', label: '', width: '80px' },
]

export function SmallTaskInputPanel({
  projects,
  selectedProjectId,
  onProjectSelect,
  weeklySchedule,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  generateTaskNo,
  userId,
}: SmallTaskInputPanelProps) {
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  // プロジェクトごとの新規タスクデータ
  const [newTaskDataByProject, setNewTaskDataByProject] = useState<
    Record<
      string,
      {
        name: string
        estimated_minutes: number
        tags: string[]
      }
    >
  >({})

  const tableRef = useRef<HTMLTableElement>(null)
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLElement>>(new Map())

  // 初期化: 各プロジェクトの新規タスクデータを設定
  useEffect(() => {
    const initialData: Record<string, { name: string; estimated_minutes: number; tags: string[] }> =
      {}
    projects.forEach(project => {
      if (!newTaskDataByProject[project.id]) {
        initialData[project.id] = {
          name: '',
          estimated_minutes: 30,
          tags: [],
        }
      }
    })
    if (Object.keys(initialData).length > 0) {
      setNewTaskDataByProject(prev => ({ ...prev, ...initialData }))
    }
  }, [projects])

  // Get all unique tags from existing tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    weeklySchedule.unscheduledTasks.forEach(task => {
      task.tags?.forEach(tag => tagSet.add(tag))
    })
    weeklySchedule.scheduleBlocks.forEach(block => {
      block.tags?.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [weeklySchedule])

  // 各プロジェクトのタスクを取得
  const getProjectTasks = useCallback(
    (projectId: string) => {
      return weeklySchedule.unscheduledTasks.filter(task => task.project_id === projectId)
    },
    [weeklySchedule.unscheduledTasks]
  )

  // セルのキーを生成（プロジェクトIDを含む）
  const getCellKey = (projectId: string, row: number, col: number) => `${projectId}-${row}-${col}`

  // セルにフォーカスを設定
  const focusCell = useCallback((projectId: string, row: number, col: number) => {
    if (col < 0 || col >= COLUMNS.length) {
      return
    }

    const cellKey = getCellKey(projectId, row, col)
    const cellElement = cellRefs.current.get(cellKey)

    if (cellElement && 'focus' in cellElement) {
      cellElement.focus()
      setFocusedCell({ row, col })
    }
  }, [])

  // キーボードイベントハンドラー
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, projectId: string, row: number, col: number) => {
      const projectTasks = getProjectTasks(projectId)
      const totalRows = projectTasks.length + 1 // +1 for new task row

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          if (row > 0) {
            focusCell(projectId, row - 1, col)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (row < totalRows - 1) {
            focusCell(projectId, row + 1, col)
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (col > 1) {
            // Skip ID column
            focusCell(projectId, row, col - 1)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (col < 3) {
            // Up to tags column
            focusCell(projectId, row, col + 1)
          }
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            // Shift+Tab: 前のセルへ
            if (col > 1) {
              focusCell(projectId, row, col - 1)
            } else if (row > 0) {
              focusCell(projectId, row - 1, 3) // 前の行のタグへ
            }
          } else {
            // Tab: 次のセルへ
            if (col < 3) {
              focusCell(projectId, row, col + 1)
            } else if (row < totalRows - 1) {
              focusCell(projectId, row + 1, 1) // 次の行のタスク名へ
            }
          }
          break
        case 'Delete':
        case 'Backspace':
          if ((e.ctrlKey || e.metaKey) && row < projectTasks.length) {
            e.preventDefault()
            const task = projectTasks[row]
            if (task && window.confirm('このタスクを削除しますか？')) {
              onDeleteTask(task.id)
            }
          }
          break
      }
    },
    [getProjectTasks, focusCell, onDeleteTask]
  )

  // Handle task creation
  const handleCreateTask = async (projectId: string) => {
    if (!onCreateTask) {
      console.error('onCreateTask function is not provided')
      toast.error('タスク作成機能が利用できません')
      return
    }

    const project = projects.find(p => p.id === projectId)
    const newTaskData = newTaskDataByProject[projectId]

    if (!project || !newTaskData) {
      toast.error('プロジェクトが見つかりません')
      return
    }

    if (!newTaskData.name.trim()) {
      toast.error('タスク名を入力してください')
      return
    }

    const projectIndex = projects.findIndex(p => p.id === projectId)
    const projectTasks = getProjectTasks(projectId)
    const taskNo = generateTaskNo(projectIndex, projectTasks.length)

    try {
      const taskData: CreateSmallTaskData = {
        big_task_id: '', // BigTaskには紐づけない
        user_id: userId,
        name: newTaskData.name,
        estimated_minutes: newTaskData.estimated_minutes,
        scheduled_start: '',
        scheduled_end: '',
        tags: newTaskData.tags,
        task_no: taskNo,
        project_id: projectId,
        // 週の情報をdescriptionに含める
        description: `Week: ${weeklySchedule.weekStartDate}`,
      }

      await onCreateTask(taskData)

      // Reset form for this project
      setNewTaskDataByProject(prev => ({
        ...prev,
        [projectId]: {
          name: '',
          estimated_minutes: 30,
          tags: [],
        },
      }))

      // Focus on task name cell again for next input
      setTimeout(() => {
        focusCell(projectId, projectTasks.length + 1, 1)
      }, 100)

      toast.success('タスクを作成しました')
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('タスクの作成に失敗しました')
    }
  }

  // Handle task update
  const handleUpdateTask = async (taskId: string, field: string, value: any) => {
    try {
      const updateData: UpdateSmallTaskData = {}

      switch (field) {
        case 'name':
          updateData.name = value
          break
        case 'estimated_minutes':
          updateData.estimated_minutes = parseInt(value) || 30
          break
        case 'tags':
          updateData.tags = value
          break
      }

      await onUpdateTask({
        id: taskId,
        data: updateData,
      })
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('タスクの更新に失敗しました')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('このタスクを削除してもよろしいですか？')) return

    try {
      await onDeleteTask(taskId)
      toast.success('タスクを削除しました')
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error('タスクの削除に失敗しました')
    }
  }

  // プロジェクトごとのテーブルをレンダリング
  const renderProjectTable = (project: Project) => {
    const projectIndex = projects.findIndex(p => p.id === project.id)
    const projectTasks = getProjectTasks(project.id)
    const newTaskData = newTaskDataByProject[project.id] || {
      name: '',
      estimated_minutes: 30,
      tags: [],
    }

    return (
      <div key={project.id} className="space-y-4">
        {/* プロジェクト名 */}
        <h3 className="text-sm font-semibold text-[#1C1C14] flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#5E621B]" />
          {project.name}
        </h3>

        {/* Task Table */}
        <div className="border rounded-lg overflow-hidden bg-[#FCFAEC]">
          <table className="w-full">
            <thead>
              <tr className="bg-[#E4E5C0] border-b border-[#D4D2C1]">
                {COLUMNS.map(column => (
                  <th
                    key={column.key}
                    style={{ width: column.width }}
                    className="text-left px-3 py-2 text-sm font-medium text-[#47473B]"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Existing tasks */}
              {projectTasks.map((task, rowIndex) => (
                <tr key={task.id} className="border-b border-[#E5E3D2] hover:bg-[#F5F3E4]">
                  {/* ID */}
                  <td className="px-3 py-2 text-sm font-medium text-[#5F6044]">{task.task_no}</td>

                  {/* Task Name */}
                  <td className="px-3 py-2">
                    <Input
                      ref={el => {
                        if (el) cellRefs.current.set(getCellKey(project.id, rowIndex, 1), el)
                      }}
                      value={task.name}
                      onChange={e => handleUpdateTask(task.id, 'name', e.target.value)}
                      onKeyDown={e => handleKeyDown(e, project.id, rowIndex, 1)}
                      onFocus={() => setFocusedCell({ row: rowIndex, col: 1 })}
                      className={cn(
                        'border-none bg-transparent h-8 px-2',
                        focusedCell?.row === rowIndex &&
                          focusedCell?.col === 1 &&
                          'bg-white ring-2 ring-[#5E621B]'
                      )}
                    />
                  </td>

                  {/* Estimated Minutes */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Input
                        ref={el => {
                          if (el) cellRefs.current.set(getCellKey(project.id, rowIndex, 2), el)
                        }}
                        type="number"
                        min="5"
                        step="5"
                        value={task.estimated_minutes}
                        onChange={e =>
                          handleUpdateTask(task.id, 'estimated_minutes', e.target.value)
                        }
                        onKeyDown={e => handleKeyDown(e, project.id, rowIndex, 2)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 2 })}
                        className={cn(
                          'border-none bg-transparent h-8 px-2 w-16 text-right',
                          focusedCell?.row === rowIndex &&
                            focusedCell?.col === 2 &&
                            'bg-white ring-2 ring-[#5E621B]'
                        )}
                      />
                      <span className="text-xs text-[#47473B]">分</span>
                    </div>
                  </td>

                  {/* Tags */}
                  <td className="px-3 py-2">
                    <Input
                      ref={el => {
                        if (el) cellRefs.current.set(getCellKey(project.id, rowIndex, 3), el)
                      }}
                      list={`tags-${project.id}-${rowIndex}`}
                      value={task.tags?.join(', ') || ''}
                      onChange={e => {
                        const tags = e.target.value
                          .split(',')
                          .map(t => t.trim())
                          .filter(t => t.length > 0)
                        handleUpdateTask(task.id, 'tags', tags)
                      }}
                      onKeyDown={e => handleKeyDown(e, project.id, rowIndex, 3)}
                      onFocus={() => setFocusedCell({ row: rowIndex, col: 3 })}
                      placeholder="タグ1, タグ2"
                      className={cn(
                        'border-none bg-transparent h-8 px-2',
                        focusedCell?.row === rowIndex &&
                          focusedCell?.col === 3 &&
                          'bg-white ring-2 ring-[#5E621B]'
                      )}
                    />
                    <datalist id={`tags-${project.id}-${rowIndex}`}>
                      {allTags.map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                      className="h-8 w-8 p-0 text-[#BA1A1A] hover:text-[#93000A]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}

              {/* New task row */}
              <tr className="bg-[#F5F3E4]">
                {/* ID */}
                <td className="px-3 py-2 text-sm font-medium text-[#5F6044]">
                  {generateTaskNo(projectIndex, projectTasks.length)}
                </td>

                {/* Task Name */}
                <td className="px-3 py-2">
                  <Input
                    ref={el => {
                      if (el)
                        cellRefs.current.set(getCellKey(project.id, projectTasks.length, 1), el)
                    }}
                    value={newTaskData.name}
                    onChange={e =>
                      setNewTaskDataByProject(prev => ({
                        ...prev,
                        [project.id]: { ...newTaskData, name: e.target.value },
                      }))
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newTaskData.name.trim()) {
                        e.preventDefault()
                        handleCreateTask(project.id)
                      } else {
                        handleKeyDown(e, project.id, projectTasks.length, 1)
                      }
                    }}
                    onFocus={() => setFocusedCell({ row: projectTasks.length, col: 1 })}
                    placeholder="新しいタスク名"
                    className={cn(
                      'border-none bg-transparent h-8 px-2',
                      focusedCell?.row === projectTasks.length &&
                        focusedCell?.col === 1 &&
                        'bg-white ring-2 ring-[#5E621B]'
                    )}
                  />
                </td>

                {/* Estimated Minutes */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Input
                      ref={el => {
                        if (el)
                          cellRefs.current.set(getCellKey(project.id, projectTasks.length, 2), el)
                      }}
                      type="number"
                      min="5"
                      step="5"
                      value={newTaskData.estimated_minutes}
                      onChange={e =>
                        setNewTaskDataByProject(prev => ({
                          ...prev,
                          [project.id]: {
                            ...newTaskData,
                            estimated_minutes: parseInt(e.target.value) || 30,
                          },
                        }))
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newTaskData.name.trim()) {
                          e.preventDefault()
                          handleCreateTask(project.id)
                        } else {
                          handleKeyDown(e, project.id, projectTasks.length, 2)
                        }
                      }}
                      onFocus={() => setFocusedCell({ row: projectTasks.length, col: 2 })}
                      className={cn(
                        'border-none bg-transparent h-8 px-2 w-16 text-right',
                        focusedCell?.row === projectTasks.length &&
                          focusedCell?.col === 2 &&
                          'bg-white ring-2 ring-[#5E621B]'
                      )}
                    />
                    <span className="text-xs text-[#47473B]">分</span>
                  </div>
                </td>

                {/* Tags */}
                <td className="px-3 py-2">
                  <Input
                    ref={el => {
                      if (el)
                        cellRefs.current.set(getCellKey(project.id, projectTasks.length, 3), el)
                    }}
                    list={`tags-${project.id}-new`}
                    value={newTaskData.tags.join(', ')}
                    onChange={e => {
                      const tags = e.target.value
                        .split(',')
                        .map(t => t.trim())
                        .filter(t => t.length > 0)
                      setNewTaskDataByProject(prev => ({
                        ...prev,
                        [project.id]: { ...newTaskData, tags },
                      }))
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (newTaskData.name.trim()) {
                          handleCreateTask(project.id)
                        }
                      } else {
                        handleKeyDown(e, project.id, projectTasks.length, 3)
                      }
                    }}
                    onFocus={() => setFocusedCell({ row: projectTasks.length, col: 3 })}
                    placeholder="タグ1, タグ2"
                    className={cn(
                      'border-none bg-transparent h-8 px-2',
                      focusedCell?.row === projectTasks.length &&
                        focusedCell?.col === 3 &&
                        'bg-white ring-2 ring-[#5E621B]'
                    )}
                  />
                  <datalist id={`tags-${project.id}-new`}>
                    {allTags.map(tag => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCreateTask(project.id)}
                    disabled={!newTaskData.name.trim()}
                    className="h-8 w-8 p-0 text-[#5F6044] hover:text-[#464A02]"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* タスクを追加ボタン */}
        <Button
          onClick={() => handleCreateTask(project.id)}
          disabled={!newTaskData.name.trim()}
          size="sm"
          className="bg-[#5F6044] hover:bg-[#464A02] text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          タスクを追加
        </Button>
      </div>
    )
  }

  return (
    <>
      <CardContent className="p-6">
        {projects.length === 0 ? (
          <div className="text-center py-8 text-[#47473B]">
            <p>プロジェクトがありません。</p>
            <p className="text-sm mt-2">プロジェクトを作成してください。</p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map(project => renderProjectTable(project))}

            {/* Keyboard shortcuts help */}
            <div className="text-xs text-[#47473B] bg-[#E5E3D2] p-3 rounded-lg">
              <p className="font-medium mb-1">キーボードショートカット：</p>
              <p>矢印キー: セル移動 | Tab: 次のセル | Shift+Tab: 前のセル | Enter: タスク作成</p>
            </div>
          </div>
        )}
      </CardContent>
    </>
  )
}
