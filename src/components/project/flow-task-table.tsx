/**
 * FlowTaskTable - フロータスク専用のテーブルコンポーネント
 */

'use client'

import { useState, useRef, useCallback, memo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface FlowTaskTableProps {
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
  { key: 'estimatedHours', label: '見積時間', width: '120px' },
  { key: 'actions', label: '', width: '40px' },
]

// BufferedInput component
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
  const [localValue, setLocalValue] = useState(type === 'number' ? String(value) : String(value))
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value

      if (type === 'number') {
        if (inputValue !== '' && !/^\d*\.?\d*$/.test(inputValue)) {
          return
        }
      }

      setLocalValue(inputValue)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        if (type === 'number') {
          const numValue = inputValue === '' ? 0 : parseFloat(inputValue) || 0
          onChange(numValue)
        } else {
          onChange(inputValue)
        }
      }, 300)
    },
    [onChange, type]
  )

  const handleBlur = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (type === 'number') {
      const numValue = localValue === '' ? 0 : parseFloat(localValue) || 0
      onChange(numValue)
    } else {
      onChange(localValue)
    }
  }, [localValue, onChange, type])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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

// SortableRow component
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
        <td className="drag-handle" {...attributes} {...listeners}>
          <span className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center h-8">
            <GripVertical className="h-4 w-4" />
          </span>
        </td>

        <td>
          <input
            type="checkbox"
            checked={selectedRows.has(task.id)}
            onChange={() => onToggleRowSelection(task.id)}
            className="rounded"
          />
        </td>

        <td>
          <BufferedInput
            inputRef={el => {
              if (el) {
                cellRefs.current.set(getCellKey(rowIndex, 2), el)
              }
            }}
            type="text"
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
        </td>

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

export function FlowTaskTable({
  tasks,
  totalTaskHours,
  projectCategories,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  onAddCategory,
  onUpdateTaskCategory,
}: FlowTaskTableProps) {
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const tableRef = useRef<HTMLTableElement>(null)
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map())

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const getCellKey = (row: number, col: number) => `${row}-${col}`

  const tasksLengthRef = useRef(tasks.length)
  useEffect(() => {
    tasksLengthRef.current = tasks.length
  }, [tasks.length])

  const focusCell = useCallback(
    (row: number, col: number) => {
      if (row < 0 || row >= tasksLengthRef.current || col < 0 || col >= COLUMNS.length) {
        return
      }

      requestAnimationFrame(() => {
        const cellKey = getCellKey(row, col)
        const cellElement = cellRefs.current.get(cellKey)

        if (cellElement && cellElement instanceof HTMLElement) {
          try {
            if (document.contains(cellElement)) {
              cellElement.focus()
              setFocusedCell({ row, col })
            }
          } catch (error) {
            console.warn('Focus error:', error)
          }
        }
      })
    },
    []
  )

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

  const addNewTask = useCallback(() => {
    onAddTask()
    setTimeout(() => {
      const newRowIndex = tasksLengthRef.current
      if (newRowIndex >= 0) {
        focusCell(newRowIndex, 2)
      }
    }, 50)
  }, [onAddTask, focusCell])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      if (col === 4 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const task = tasks[row]
        if (task) {
          const currentValue = task.estimatedHours || 0
          const newValue = e.key === 'ArrowUp' 
            ? currentValue + 0.5 
            : Math.max(0, currentValue - 0.5)
          onUpdateTask(task.id, { estimatedHours: newValue })
        }
        return
      }
      
      switch (e.key) {
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            if (col > 2) {
              focusCell(row, col - 1)
            } else if (row > 0) {
              focusCell(row - 1, 4)
            }
          } else {
            if (col < 4) {
              focusCell(row, col + 1)
            } else {
              if (row === tasksLengthRef.current - 1) {
                addNewTask()
              }
              setTimeout(() => focusCell(row + 1, 2), 0)
            }
          }
          break
        case 'Enter':
          e.preventDefault()
          if (col === 4) {
            if (row === tasksLengthRef.current - 1) {
              addNewTask()
            } else {
              setTimeout(() => focusCell(row + 1, 2), 0)
            }
          }
          break
        case 'Delete':
        case 'Backspace':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (window.confirm('このタスクを削除しますか？')) {
              onDeleteTask(tasks[row].id)
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
    [focusCell, onDeleteTask, addNewTask, tasks, onUpdateTask]
  )

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
          return
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

  const deleteSelectedRows = useCallback(() => {
    if (selectedRows.size === 0) return

    if (window.confirm(`${selectedRows.size}件のタスクを削除しますか？`)) {
      selectedRows.forEach(taskId => {
        onDeleteTask(taskId)
      })
      setSelectedRows(new Set())
    }
  }, [selectedRows, onDeleteTask])


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={addNewTask} size="sm" variant="outline">
            フロータスクを追加
          </Button>
          {selectedRows.size > 0 && (
            <Button onClick={deleteSelectedRows} size="sm" variant="destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              選択を削除 ({selectedRows.size})
            </Button>
          )}
        </div>
      </div>

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
                {tasks.map((task, rowIndex) => (
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
                }
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>
    </div>
  )
}