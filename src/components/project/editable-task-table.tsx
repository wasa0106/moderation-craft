/**
 * EditableTaskTable - スプレッドシートライクなタスクテーブル
 * キーボード操作による効率的な入力を提供
 */

'use client'

import { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Trash2, GripVertical } from 'lucide-react'
import { Task } from '@/stores/project-creation-store'
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

// 入力フィールドコンポーネント（ローカルステート管理）
interface BufferedInputProps {
  value: string | number
  onChange: (value: string | number) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onFocus?: () => void
  type?: 'text' | 'number'
  placeholder?: string
  className?: string
  list?: string
  min?: number
  max?: number
  step?: number
  inputRef?: (el: HTMLInputElement | null) => void
}

const BufferedInput = memo(function BufferedInput({
  value,
  onChange,
  onKeyDown,
  onFocus,
  type = 'text',
  placeholder = '',
  className = '',
  list,
  min,
  max,
  step,
  inputRef,
}: BufferedInputProps) {
  // 内部状態は常に文字列として管理（数値入力でも）
  const [localValue, setLocalValue] = useState(
    type === 'number' ? String(value) : String(value)
  )
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 親コンポーネントの値が変更されたら同期
  useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value

      // 数値入力の場合、簡単なバリデーション
      if (type === 'number') {
        // 数値、ピリオド、空文字列以外は入力を無視
        if (inputValue !== '' && !/^\d*\.?\d*$/.test(inputValue)) {
          return
        }
      }

      // 内部状態は常に文字列として保持
      setLocalValue(inputValue)

      // デバウンス処理
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        if (type === 'number') {
          // 親コンポーネントに渡す時に数値に変換
          const numValue = inputValue === '' ? 0 : parseFloat(inputValue) || 0
          onChange(numValue)
        } else {
          onChange(inputValue)
        }
      }, 300) // 300ms後に親コンポーネントに反映
    },
    [onChange, type]
  )

  const handleBlur = useCallback(() => {
    // Blur時は即座に親コンポーネントに反映
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (type === 'number') {
      // 数値の場合は適切に変換
      const numValue = localValue === '' ? 0 : parseFloat(localValue) || 0
      onChange(numValue)
    } else {
      onChange(localValue)
    }
  }, [localValue, onChange, type])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enterキーが押されたら即座に値を確定
      if (e.key === 'Enter') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        if (type === 'number') {
          const numValue = localValue === '' ? 0 : parseFloat(localValue) || 0
          onChange(numValue)
        } else {
          onChange(localValue)
        }
      }
      // 親コンポーネントのonKeyDownを呼び出す
      if (onKeyDown) {
        onKeyDown(e)
      }
    },
    [localValue, onChange, onKeyDown, type]
  )

  return (
    <Input
      ref={inputRef}
      type={type}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      className={className}
      list={list}
      min={min}
      max={max}
      step={step}
    />
  )
})

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
  cellRefs: React.RefObject<Map<string, HTMLElement>>
  getCellKey: (row: number, col: number) => string
}

const SortableRow = memo(
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
          <span className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center h-8">
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
        <td>
          <BufferedInput
            inputRef={el => {
              if (el) {
                cellRefs.current.set(getCellKey(rowIndex, 2), el)
              }
            }}
            type="text"
            list={`category-options-${rowIndex}`}
            value={task.category}
            onChange={value => {
              onUpdateCellValue(rowIndex, 2, value as string)
              const trimmedValue = (value as string).trim()
              if (trimmedValue) {
                onAddCategory(trimmedValue)
              }
            }}
            onKeyDown={e => onKeyDown(e, rowIndex, 2)}
            onFocus={() => onFocus(rowIndex, 2)}
            placeholder=""
            className={`border-none bg-transparent cell-input ${
              focusedCell?.row === rowIndex && focusedCell?.col === 2 ? 'cell-focused' : ''
            }`}
          />
          <datalist id={`category-options-${rowIndex}`}>
            {projectCategories.map(category => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </td>

        {/* タスク名 */}
        <td>
          <BufferedInput
            inputRef={el => {
              if (el) {
                cellRefs.current.set(getCellKey(rowIndex, 3), el)
              }
            }}
            value={task.name}
            onChange={value => onUpdateCellValue(rowIndex, 3, value as string)}
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
            <BufferedInput
              inputRef={el => {
                if (el) {
                  cellRefs.current.set(getCellKey(rowIndex, 4), el)
                }
              }}
              type="number"
              min={0}
              step={0.5}
              value={task.estimatedHours || ''}
              onChange={value => onUpdateCellValue(rowIndex, 4, value)}
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
  },
  (prevProps, nextProps) => {
    // カスタム比較関数：必要なプロパティのみをチェック
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.name === nextProps.task.name &&
      prevProps.task.category === nextProps.task.category &&
      prevProps.task.estimatedHours === nextProps.task.estimatedHours &&
      prevProps.rowIndex === nextProps.rowIndex &&
      prevProps.selectedRows.has(prevProps.task.id) ===
        nextProps.selectedRows.has(nextProps.task.id) &&
      prevProps.focusedCell?.row === nextProps.focusedCell?.row &&
      prevProps.focusedCell?.col === nextProps.focusedCell?.col &&
      prevProps.projectCategories.length === nextProps.projectCategories.length
    )
  }
)

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

  // ドラッグ&ドロップ用のセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // セルのキーを生成
  const getCellKey = (row: number, col: number) => `${row}-${col}`

  // tasksの参照を保持（再レンダリング時の関数再生成を防ぐ）
  const tasksLengthRef = useRef(tasks.length)
  useEffect(() => {
    tasksLengthRef.current = tasks.length
  }, [tasks.length])

  // セルにフォーカスを設定
  const focusCell = useCallback(
    (row: number, col: number) => {
      if (row < 0 || row >= tasksLengthRef.current || col < 0 || col >= COLUMNS.length) {
        return
      }

      // 非同期処理の競合を防ぐため、微小な遅延を追加
      requestAnimationFrame(() => {
        const cellKey = getCellKey(row, col)
        const cellElement = cellRefs.current.get(cellKey)

        if (cellElement && cellElement instanceof HTMLElement) {
          try {
            // 要素がドキュメントに存在することを確認
            if (document.contains(cellElement)) {
              cellElement.focus()
              setFocusedCell({ row, col })
            }
          } catch (error) {
            // フォーカスエラーをキャッチして継続
            console.warn('Focus error:', error)
          }
        }
      })
    },
    [] // 依存配列を空にして関数の再生成を防ぐ
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
    // 少し遅延を増やして、タスクの追加が確実に完了してからフォーカス
    setTimeout(() => {
      const newRowIndex = tasksLengthRef.current
      // 新しい行が実際に存在することを確認
      if (newRowIndex >= 0) {
        focusCell(newRowIndex, 2) // カテゴリ列（ドラッグハンドル分+1）
      }
    }, 50) // 50msの遅延で安定性を向上
  }, [onAddTask, focusCell])

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
              if (row === tasksLengthRef.current - 1) {
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
            if (row === tasksLengthRef.current - 1) {
              // 最後の行の場合はaddNewTaskに任せる
              addNewTask()
              // addNewTask内でフォーカス処理を行うため、ここではフォーカスしない
            } else {
              // 最後の行でない場合のみ次の行へ
              setTimeout(() => focusCell(row + 1, 2), 0)
            }
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
              } else if (tasksLengthRef.current > 1) {
                setTimeout(() => focusCell(0, col), 0)
              }
            }
          }
          break
      }
    },
    [focusCell, onDeleteTask, addNewTask, tasks] // tasksを追加して削除時の正しいtaskIdを取得
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

  // カテゴリ別時間配分の計算（メモ化）
  const categoryStats = useMemo(
    () =>
      projectCategories
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
        .filter(stat => stat.hours > 0),
    [projectCategories, tasks, totalTaskHours]
  )

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedRows.size > 0 && (
            <Button onClick={deleteSelectedRows} size="sm" variant="destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              選択を削除 ({selectedRows.size})
            </Button>
          )}
        </div>

      </div>

      {/* テーブル */}
      <div className="border rounded-lg overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table ref={tableRef} className="editable-table w-full">
            <thead>
              <tr>
                {COLUMNS.map(column => (
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
                          Tab または Enter キーで新しいタスクを追加できます
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
            {categoryStats.map(({ category, hours, percentage }) => (
              <div key={category} className="flex items-center gap-3">
                <Badge variant="secondary" className="min-w-[80px]">
                  {category}
                </Badge>
                <div className="flex-1">
                  <Progress value={percentage} className="h-2" />
                </div>
                <span className="text-sm text-muted-foreground min-w-[80px]">
                  {hours}h ({percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
