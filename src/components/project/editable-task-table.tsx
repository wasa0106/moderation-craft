/**
 * EditableTaskTable - スプレッドシートライクなタスクテーブル
 * キーボード操作による効率的な入力を提供
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Trash2, Plus, GripVertical } from 'lucide-react'
import { Task, useProjectCreationStore } from '@/stores/project-creation-store'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface EditableTaskTableProps {
  tasks: Task[]
  totalTaskHours: number
  projectCategories: string[]
  onAddTask: () => void
  onUpdateTask: (id: string, updates: Partial<Task>) => void
  onDeleteTask: (id: string) => void
  onReorderTasks: (startIndex: number, endIndex: number) => void
  onAddCategory: (category: string) => void
  onUpdateTaskCategory: (taskId: string, category: string) => void
}

interface CellPosition {
  row: number
  col: number
}

const COLUMNS = [
  { key: 'drag', label: '', width: '40px' },
  { key: 'select', label: '', width: '40px' },
  { key: 'category', label: 'カテゴリ', width: '140px' },
  { key: 'name', label: 'タスク名', width: 'auto' },
  { key: 'estimatedHours', label: '見積時間', width: '100px' },
  { key: 'actions', label: '', width: '40px' },
]

// ドラッグ可能な行コンポーネント
interface SortableRowProps {
  task: Task
  rowIndex: number
  selectedRows: Set<string>
  focusedCell: CellPosition | null
  projectCategories: string[]
  onToggleRowSelection: (taskId: string) => void
  onUpdateCellValue: (row: number, col: number, value: string | number) => void
  onAddCategory: (category: string) => void
  onDeleteTask: (taskId: string) => void
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void
  onFocus: (row: number, col: number) => void
  cellRefs: React.MutableRefObject<Map<string, HTMLElement>>
  getCellKey: (row: number, col: number) => string
  getCategoryColor: (category: string) => string
  getCategoryBgColor: (color: string) => string
}

function SortableRow({
  task,
  rowIndex,
  selectedRows,
  focusedCell,
  projectCategories,
  onToggleRowSelection,
  onUpdateCellValue,
  onAddCategory,
  onDeleteTask,
  onKeyDown,
  onFocus,
  cellRefs,
  getCellKey,
  getCategoryColor,
  getCategoryBgColor,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${selectedRows.has(task.id) ? 'bg-muted' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      {/* ドラッグハンドル */}
      <td className="drag-handle" {...attributes} {...listeners}>
        <span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex items-center justify-center h-8">
          <GripVertical className="h-4 w-4" />
        </span>
      </td>

      {/* チェックボックス */}
      <td>
        <input
          type="checkbox"
          checked={selectedRows.has(task.id)}
          onChange={() => onToggleRowSelection(task.id)}
          className="rounded"
        />
      </td>

      {/* カテゴリ */}
      <td style={{ position: 'relative' }}>
        {/* カテゴリ色インジケーター */}
        {task.category && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{
              backgroundColor: getCategoryColor(task.category),
              borderRadius: '2px 0 0 2px',
            }}
          />
        )}
        <Input
          ref={el => {
            if (el) {
              cellRefs.current.set(getCellKey(rowIndex, 2), el)
            }
          }}
          type="text"
          list={`category-options-${rowIndex}`}
          value={task.category}
          onChange={e => onUpdateCellValue(rowIndex, 2, e.target.value)}
          onKeyDown={e => onKeyDown(e, rowIndex, 2)}
          onFocus={() => onFocus(rowIndex, 2)}
          onBlur={e => {
            const value = e.target.value.trim()
            if (value) {
              onAddCategory(value)
            }
          }}
          placeholder=""
          className={`border-none bg-transparent cell-input pl-3 ${
            focusedCell?.row === rowIndex && focusedCell?.col === 2 ? 'cell-focused' : ''
          }`}
          style={
            task.category
              ? {
                  backgroundColor: getCategoryBgColor(getCategoryColor(task.category)),
                  borderLeft: `3px solid ${getCategoryColor(task.category)}`,
                }
              : {}
          }
        />
        <datalist id={`category-options-${rowIndex}`}>
          {projectCategories.map(category => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </td>

      {/* タスク名 */}
      <td>
        <Input
          ref={el => {
            if (el) {
              cellRefs.current.set(getCellKey(rowIndex, 3), el)
            }
          }}
          value={task.name}
          onChange={e => onUpdateCellValue(rowIndex, 3, e.target.value)}
          onKeyDown={e => onKeyDown(e, rowIndex, 3)}
          onFocus={() => onFocus(rowIndex, 3)}
          placeholder=""
          className={`border-none bg-transparent cell-input ${
            focusedCell?.row === rowIndex && focusedCell?.col === 3 ? 'cell-focused' : ''
          }`}
        />
      </td>

      {/* 見積時間 */}
      <td>
        <div className="flex items-center gap-1">
          <Input
            ref={el => {
              if (el) {
                cellRefs.current.set(getCellKey(rowIndex, 4), el)
              }
            }}
            type="number"
            min="0"
            step="0.5"
            value={task.estimatedHours || ''}
            onChange={e => onUpdateCellValue(rowIndex, 4, e.target.value)}
            onKeyDown={e => onKeyDown(e, rowIndex, 4)}
            onFocus={() => onFocus(rowIndex, 4)}
            placeholder=""
            className={`border-none bg-transparent cell-input text-right ${
              focusedCell?.row === rowIndex && focusedCell?.col === 4 ? 'cell-focused' : ''
            }`}
          />
          <span className="text-xs text-muted-foreground">h</span>
        </div>
      </td>

      {/* アクション */}
      <td>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDeleteTask(task.id)}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}

export function EditableTaskTable({
  tasks,
  totalTaskHours,
  projectCategories,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  onAddCategory,
  onUpdateTaskCategory,
}: EditableTaskTableProps) {
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const tableRef = useRef<HTMLTableElement>(null)
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map())

  // カテゴリ色取得
  const getCategoryColor = useProjectCreationStore(state => state.getCategoryColor)

  // 背景色を薄くする関数
  const getCategoryBgColor = (color: string) => {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, 0.15)`
  }

  // ドラッグ&ドロップ用のセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // セルのキーを生成
  const getCellKey = (row: number, col: number) => `${row}-${col}`

  // セルにフォーカスを設定
  const focusCell = useCallback(
    (row: number, col: number) => {
      if (row < 0 || row >= tasks.length || col < 0 || col >= COLUMNS.length) {
        return
      }

      const cellKey = getCellKey(row, col)
      const cellElement = cellRefs.current.get(cellKey)

      if (cellElement) {
        cellElement.focus()
        setFocusedCell({ row, col })
      }
    },
    [tasks.length]
  )

  // ドラッグ終了時の処理
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (active.id !== over?.id) {
        const oldIndex = tasks.findIndex(task => task.id === active.id)
        const newIndex = tasks.findIndex(task => task.id === over?.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          onReorderTasks(oldIndex, newIndex)
        }
      }
    },
    [tasks, onReorderTasks]
  )

  // 新しいタスクを追加
  const addNewTask = useCallback(() => {
    onAddTask()
    // 新しいタスクが追加された後、カテゴリセルにフォーカス
    setTimeout(() => {
      focusCell(tasks.length, 2) // カテゴリ列（ドラッグハンドル分+1）
    }, 0)
  }, [onAddTask, tasks.length, focusCell])

  // キーボードイベントハンドラー
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          focusCell(row - 1, col)
          break
        case 'ArrowDown':
          e.preventDefault()
          focusCell(row + 1, col)
          break
        case 'ArrowLeft':
          e.preventDefault()
          focusCell(row, col - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          focusCell(row, col + 1)
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            // Shift+Tab: 前のセルへ
            if (col > 2) {
              focusCell(row, col - 1)
            } else if (row > 0) {
              focusCell(row - 1, 4) // 前の行の見積時間へ
            }
          } else {
            // Tab: 次のセルへ
            if (col < 4) {
              focusCell(row, col + 1)
            } else {
              // 見積時間セル（col=4）から次の行のカテゴリ（col=2）へ
              if (row === tasks.length - 1) {
                addNewTask()
              }
              setTimeout(() => focusCell(row + 1, 2), 0)
            }
          }
          break
        case 'Enter':
          e.preventDefault() // すべての列でフォーム送信を防ぐ
          if (col === 4) {
            // 見積時間列でのみ次の行へ移動
            if (row === tasks.length - 1) {
              addNewTask()
            }
            setTimeout(() => focusCell(row + 1, 2), 0) // 次の行のカテゴリへ
          }
          // カテゴリ・タスク名セルではEnterキーは入力確定のみ（次の行へは移動しない）
          break
        case 'Delete':
        case 'Backspace':
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+Delete: 行を削除
            e.preventDefault()
            if (window.confirm('このタスクを削除しますか？')) {
              onDeleteTask(tasks[row].id)
              // フォーカスを調整
              if (row > 0) {
                setTimeout(() => focusCell(row - 1, col), 0)
              } else if (tasks.length > 1) {
                setTimeout(() => focusCell(0, col), 0)
              }
            }
          }
          break
      }
    },
    [focusCell, tasks.length, onDeleteTask, addNewTask]
  )

  // セルの値を更新
  const updateCellValue = useCallback(
    (row: number, col: number, value: string | number) => {
      const task = tasks[row]
      if (!task) return

      const column = COLUMNS[col]
      const updates: Partial<Task> = {}

      switch (column.key) {
        case 'category':
          const categoryValue = value as string
          onUpdateTaskCategory(task.id, categoryValue)
          return // カテゴリ更新は専用メソッドで処理
        case 'name':
          updates.name = value as string
          break
        case 'estimatedHours':
          updates.estimatedHours =
            typeof value === 'number' ? value : parseFloat(value as string) || 0
          break
      }

      onUpdateTask(task.id, updates)
    },
    [tasks, onUpdateTask, onUpdateTaskCategory]
  )

  // チェックボックスの状態変更
  const toggleRowSelection = useCallback((taskId: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }, [])

  // 選択された行を削除
  const deleteSelectedRows = useCallback(() => {
    if (selectedRows.size === 0) return

    if (window.confirm(`${selectedRows.size}件のタスクを削除しますか？`)) {
      selectedRows.forEach(taskId => {
        onDeleteTask(taskId)
      })
      setSelectedRows(new Set())
    }
  }, [selectedRows, onDeleteTask])

  // カテゴリ別時間配分の計算
  const categoryStats = projectCategories
    .map(category => {
      const categoryTasks = tasks.filter(t => t.category === category)
      const categoryHours = categoryTasks.reduce((sum, t) => sum + t.estimatedHours, 0)
      const percentage = totalTaskHours > 0 ? (categoryHours / totalTaskHours) * 100 : 0

      return {
        category,
        hours: Number(categoryHours.toFixed(1)),
        percentage: Number(percentage.toFixed(1)),
      }
    })
    .filter(stat => stat.hours > 0)

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={addNewTask} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            タスクを追加
          </Button>
          {selectedRows.size > 0 && (
            <Button onClick={deleteSelectedRows} size="sm" variant="destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              選択を削除 ({selectedRows.size})
            </Button>
          )}
        </div>

        <div className="text-sm text-muted-foreground">合計: {totalTaskHours.toFixed(1)}時間</div>
      </div>

      {/* テーブル */}
      <div className="border rounded-lg overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table ref={tableRef} className="editable-table w-full">
            <thead>
              <tr>
                {COLUMNS.map((column, colIndex) => (
                  <th key={column.key} style={{ width: column.width }} className="text-left">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <SortableContext
              items={tasks.map(task => task.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="text-center py-8 text-muted-foreground">
                      <div>
                        <p>タスクがありません</p>
                        <p className="text-sm mt-1">
                          「タスクを追加」ボタンでタスクを作成してください
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task, rowIndex) => (
                    <SortableRow
                      key={task.id}
                      task={task}
                      rowIndex={rowIndex}
                      selectedRows={selectedRows}
                      focusedCell={focusedCell}
                      projectCategories={projectCategories}
                      onToggleRowSelection={toggleRowSelection}
                      onUpdateCellValue={updateCellValue}
                      onAddCategory={onAddCategory}
                      onDeleteTask={onDeleteTask}
                      onKeyDown={handleKeyDown}
                      onFocus={(row, col) => setFocusedCell({ row, col })}
                      cellRefs={cellRefs}
                      getCellKey={getCellKey}
                      getCategoryColor={getCategoryColor}
                      getCategoryBgColor={getCategoryBgColor}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {/* カテゴリ別時間配分 */}
      {categoryStats.length > 0 && (
        <div className="space-y-3">
          <Label>カテゴリ別時間配分</Label>
          <div className="space-y-2">
            {categoryStats.map(({ category, hours, percentage }) => {
              const categoryColor = getCategoryColor(category)
              return (
                <div key={category} className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className="min-w-[80px] flex items-center gap-2"
                    style={{
                      backgroundColor: getCategoryBgColor(categoryColor),
                      borderColor: categoryColor,
                      color: categoryColor,
                      borderWidth: '1px',
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: categoryColor }}
                    />
                    {category}
                  </Badge>
                  <div className="flex-1">
                    <Progress
                      value={percentage}
                      className="h-2"
                      style={
                        {
                          '--progress-foreground': categoryColor,
                          backgroundColor: getCategoryBgColor(categoryColor),
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <span className="text-sm text-muted-foreground min-w-[80px]">
                    {hours}h ({percentage}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* キーボードショートカットのヘルプ */}
      <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
        <p className="font-medium mb-1">キーボードショートカット：</p>
        <p>
          矢印キー: セル移動 | Tab: 次のセル | Shift+Tab: 前のセル | Enter: 次の行 | Ctrl+Delete:
          行削除
        </p>
      </div>
    </div>
  )
}
