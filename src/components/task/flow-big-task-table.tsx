'use client'

import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import { BigTask, CreateBigTaskData } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { ChevronDown, ChevronRight, Trash2, CheckCircle2, Circle, GripVertical, Pencil, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface FlowBigTaskTableProps {
  tasks: BigTask[]
  projectId: string
  onUpdate: (id: string, data: Partial<BigTask>) => Promise<void>
  onCreate: (data: CreateBigTaskData) => Promise<void>
  onDelete: (taskId: string) => void
  onStatusChange?: (taskId: string, status: 'completed' | 'active') => Promise<void>
  isLoading: boolean
}

interface CellPosition {
  row: number
  col: number
}

const COLUMNS = [
  { key: 'drag', label: '', width: '40px' },
  { key: 'select', label: '', width: '40px' },
  { key: 'category', label: 'カテゴリ', width: '180px' },
  { key: 'name', label: 'タスク名', width: 'auto' },
  { key: 'estimatedHours', label: '見積時間', width: '120px' },
  { key: 'actions', label: '', width: '100px' },
]

// BufferedInput component
interface BufferedInputProps {
  value: string | number
  onChange: (value: string | number) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onFocus?: () => void
  onBlur?: () => void
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  className?: string
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
  onBlur,
  type = 'text',
  placeholder,
  className,
  min,
  max,
  step,
  inputRef,
}: BufferedInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = type === 'number' ? 
      (e.target.value === '' ? 0 : parseFloat(e.target.value)) : 
      e.target.value
    setLocalValue(newValue)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue)
    }, 500)
  }, [onChange, type])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <Input
      ref={inputRef}
      type={type}
      value={localValue}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cn('cell-input', className)}
      min={min}
      max={max}
      step={step}
    />
  )
})

// SortableRow component
interface SortableRowProps {
  task: BigTask
  rowIndex: number
  focusedCell: CellPosition | null
  selectedRows: Set<string>
  onToggleRowSelection: (taskId: string) => void
  onUpdateCellValue: (row: number, col: number, value: any) => void
  onDelete: (taskId: string) => void
  onStatusChange?: (taskId: string, status: 'completed' | 'active') => Promise<void>
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void
  onFocus: (row: number, col: number) => void
  cellRefs: React.MutableRefObject<Map<string, HTMLElement>>
  getCellKey: (row: number, col: number) => string
}

const SortableRow = memo(function SortableRow({
  task,
  rowIndex,
  focusedCell,
  selectedRows,
  onToggleRowSelection,
  onUpdateCellValue,
  onDelete,
  onStatusChange,
  onKeyDown,
  onFocus,
  cellRefs,
  getCellKey,
}: SortableRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'cancelled':
        return 'text-gray-500'
      default:
        return ''
    }
  }

  const categoryClasses = useMemo(() => {
    const isOther = !task.category || task.category === 'その他'
    return {
      select: cn(
        'h-8 border-none bg-transparent cell-input',
        isOther && 'italic text-muted-foreground',
        focusedCell?.row === rowIndex && focusedCell?.col === 1 && 'cell-focused'
      ),
      text: isOther ? 'italic text-muted-foreground' : ''
    }
  }, [task.category, rowIndex, focusedCell])

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'sortable-item',
        isDragging && 'opacity-50',
        selectedRows.has(task.id) && 'bg-muted'
      )}
    >
      <td className="w-10">
        <div
          {...attributes}
          {...listeners}
          className="cursor-move p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
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
        {isEditing ? (
          <BufferedInput
            inputRef={el => {
              if (el) cellRefs.current.set(getCellKey(rowIndex, 1), el)
            }}
            value={task.category || ''}
            onChange={value => onUpdateCellValue(rowIndex, 1, value)}
            onKeyDown={e => onKeyDown(e, rowIndex, 1)}
            onFocus={() => onFocus(rowIndex, 1)}
            placeholder=""
            className={`border-none bg-transparent cell-input ${
              focusedCell?.row === rowIndex && focusedCell?.col === 1 ? 'cell-focused' : ''
            }`}
          />
        ) : (
          <span className="px-2">{task.category || ''}</span>
        )}
      </td>

      <td>
        {isEditing ? (
          <BufferedInput
            inputRef={el => {
              if (el) cellRefs.current.set(getCellKey(rowIndex, 2), el)
            }}
            value={task.name}
            onChange={value => onUpdateCellValue(rowIndex, 2, value)}
            onKeyDown={e => onKeyDown(e, rowIndex, 2)}
            onFocus={() => onFocus(rowIndex, 2)}
            placeholder="タスク名"
            className={cn(
              'border-none bg-transparent h-8 font-medium',
              focusedCell?.row === rowIndex && focusedCell?.col === 2 && 'ring-2 ring-ring'
            )}
          />
        ) : (
          <span className="px-2 font-medium">{task.name}</span>
        )}
      </td>

      <td>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <BufferedInput
              inputRef={el => {
                if (el) cellRefs.current.set(getCellKey(rowIndex, 3), el)
              }}
              type="number"
              value={task.estimated_hours || 0}
              onChange={value => onUpdateCellValue(rowIndex, 3, value)}
              onKeyDown={e => onKeyDown(e, rowIndex, 3)}
              onFocus={() => onFocus(rowIndex, 3)}
              min={0}
              step={0.5}
              placeholder="0"
              className={cn(
                'border-none bg-transparent h-8 text-right',
                focusedCell?.row === rowIndex && focusedCell?.col === 3 && 'ring-2 ring-ring'
              )}
            />
            <span className="text-xs text-muted-foreground">h</span>
          </div>
        ) : (
          <div className="text-right px-2">
            {task.estimated_hours || 0}h
          </div>
        )}
      </td>

      <td>
        <div className="flex items-center justify-end gap-2">
          {onStatusChange && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onStatusChange(task.id, task.status === 'completed' ? 'active' : 'completed')}
              className={task.status === 'completed' ? 'text-green-600' : 'text-gray-600'}
              title={task.status === 'completed' ? '完了を取り消す' : 'タスクを完了にする'}
            >
              {task.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(!isEditing)}
            className={isEditing ? 'text-blue-600' : 'text-gray-600'}
            title={isEditing ? '編集を終了' : 'タスクを編集'}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(task.id)}
            className="text-red-600 hover:text-red-700"
            title="タスクを削除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
})

// NewTaskRow component
const NewTaskRow = memo(function NewTaskRow({ 
  onCreateTask, 
  focusedCell, 
  onKeyDown, 
  onFocus, 
  cellRefs, 
  getCellKey, 
  rowIndex 
}: {
  onCreateTask: (task: Partial<BigTask>) => void
  focusedCell: CellPosition | null
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void
  onFocus: (row: number, col: number) => void
  cellRefs: React.MutableRefObject<Map<string, HTMLElement>>
  getCellKey: (row: number, col: number) => string
  rowIndex: number
}) {
  const [newTask, setNewTask] = useState<Partial<BigTask>>({
    name: '',
    category: '',
    estimated_hours: 0,
    status: 'active',
    task_type: 'flow',
  })

  const handleUpdateField = useCallback((field: string, value: any) => {
    setNewTask(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, col: number) => {
    if (e.key === 'Enter' && !e.shiftKey && newTask.name?.trim()) {
      e.preventDefault()
      onCreateTask(newTask)
      setNewTask({
        name: '',
        category: '',
        estimated_hours: 0,
        status: 'active',
        task_type: 'flow',
      })
      
      setTimeout(() => {
        const nameInput = cellRefs.current.get(getCellKey(rowIndex, 2))
        if (nameInput && nameInput instanceof HTMLInputElement) {
          nameInput.focus()
        }
      }, 100)
    } else {
      onKeyDown(e, rowIndex, col)
    }
  }, [newTask, onCreateTask, onKeyDown, rowIndex, cellRefs, getCellKey])

  const categoryClasses = useMemo(() => {
    const isOther = !newTask.category || newTask.category === 'その他'
    return cn(
      'h-8 border-none bg-transparent cell-input',
      isOther && 'italic text-muted-foreground',
      focusedCell?.row === rowIndex && focusedCell?.col === 1 && 'cell-focused'
    )
  }, [newTask.category, rowIndex, focusedCell])

  return (
    <tr className="border-t bg-muted/30">
      <td className="w-10">
        <div className="p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground/30" />
        </div>
      </td>

      <td className="w-10">
        <input type="checkbox" disabled className="rounded opacity-50" />
      </td>

      <td>
        <BufferedInput
          inputRef={el => {
            if (el) cellRefs.current.set(getCellKey(rowIndex, 1), el)
          }}
          value={newTask.category || ''}
          onChange={value => handleUpdateField('category', value)}
          onKeyDown={e => handleKeyDown(e, 1)}
          onFocus={() => onFocus(rowIndex, 1)}
          placeholder=""
          className={`border-none bg-transparent cell-input ${
            focusedCell?.row === rowIndex && focusedCell?.col === 1 ? 'cell-focused' : ''
          }`}
        />
      </td>

      <td>
        <BufferedInput
          inputRef={el => {
            if (el) cellRefs.current.set(getCellKey(rowIndex, 2), el)
          }}
          value={newTask.name || ''}
          onChange={value => handleUpdateField('name', value)}
          onKeyDown={e => handleKeyDown(e, 2)}
          onFocus={() => onFocus(rowIndex, 2)}
          placeholder=""
          className={cn(
            'border-none bg-transparent cell-input font-medium',
            focusedCell?.row === rowIndex && focusedCell?.col === 2 && 'cell-focused'
          )}
        />
      </td>

      <td>
        <div className="flex items-center gap-1">
          <BufferedInput
            inputRef={el => {
              if (el) cellRefs.current.set(getCellKey(rowIndex, 3), el)
            }}
            type="number"
            value={newTask.estimated_hours || ''}
            onChange={value => handleUpdateField('estimated_hours', value)}
            onKeyDown={e => handleKeyDown(e, 3)}
            onFocus={() => onFocus(rowIndex, 3)}
            min={0}
            step={0.5}
            placeholder=""
            className={cn(
              'border-none bg-transparent cell-input text-right',
              focusedCell?.row === rowIndex && focusedCell?.col === 3 && 'cell-focused'
            )}
          />
          <span className="text-xs text-muted-foreground">h</span>
        </div>
      </td>

      <td>
        <div className="text-right text-muted-foreground">-</div>
      </td>
    </tr>
  )
})

export function FlowBigTaskTable({
  tasks,
  projectId,
  onUpdate,
  onCreate,
  onDelete,
  onStatusChange,
  isLoading,
}: FlowBigTaskTableProps) {
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null)
  const [sortedTasks, setSortedTasks] = useState<BigTask[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  
  const tableRef = useRef<HTMLTableElement>(null)
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Filter and sort tasks
  useEffect(() => {
    const flowTasks = tasks.filter(t => t.task_type !== 'recurring')
    setSortedTasks([...flowTasks].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (a.status !== 'completed' && b.status === 'completed') return -1
      
      const aIsOther = !a.category || a.category === 'その他'
      const bIsOther = !b.category || b.category === 'その他'
      
      if (aIsOther && !bIsOther) return 1
      if (!aIsOther && bIsOther) return -1
      return 0
    }))
  }, [tasks])

  const getCellKey = useCallback((row: number, col: number) => `${row}-${col}`, [])

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

  const updateCellValue = useCallback(async (row: number, col: number, value: any) => {
    const task = sortedTasks[row]
    if (!task) return

    let updateData: Partial<BigTask> = {}
    
    switch (col) {
      case 1:
        updateData.category = value
        break
      case 2:
        updateData.name = value
        break
      case 3:
        updateData.estimated_hours = typeof value === 'string' ? parseFloat(value) || 0 : value
        break
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await onUpdate(task.id, updateData)
      } catch (error) {
        console.error('Failed to update task:', error)
        toast.error('タスクの更新に失敗しました')
      }
    }
  }, [sortedTasks, onUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, row: number, col: number) => {
    const maxRow = sortedTasks.length
    const maxCol = 3

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (row > 0) {
          setFocusedCell({ row: row - 1, col })
          setTimeout(() => {
            const cell = cellRefs.current.get(getCellKey(row - 1, col))
            if (cell && cell instanceof HTMLElement) {
              cell.focus()
            }
          }, 0)
        }
        break
      case 'ArrowDown':
      case 'Enter':
        e.preventDefault()
        if (row < maxRow) {
          setFocusedCell({ row: row + 1, col })
          setTimeout(() => {
            const cell = cellRefs.current.get(getCellKey(row + 1, col))
            if (cell && cell instanceof HTMLElement) {
              cell.focus()
            }
          }, 0)
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (col > 1) {
          setFocusedCell({ row, col: col - 1 })
          setTimeout(() => {
            const cell = cellRefs.current.get(getCellKey(row, col - 1))
            if (cell && cell instanceof HTMLElement) {
              cell.focus()
            }
          }, 0)
        }
        break
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault()
        if (col < maxCol) {
          setFocusedCell({ row, col: col + 1 })
          setTimeout(() => {
            const cell = cellRefs.current.get(getCellKey(row, col + 1))
            if (cell && cell instanceof HTMLElement) {
              cell.focus()
            }
          }, 0)
        }
        break
    }
  }, [sortedTasks.length, getCellKey])

  const handleCreateTask = useCallback(async (newTask: Partial<BigTask>) => {
    if (!newTask.name?.trim()) return

    const createData: CreateBigTaskData = {
      project_id: projectId,
      user_id: 'current-user',
      name: newTask.name.trim(),
      category: newTask.category || 'その他',
      estimated_hours: newTask.estimated_hours || 8,
      actual_hours: 0,
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      task_type: 'flow',
    }

    try {
      await onCreate(createData)
      toast.success('タスクを作成しました')
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('タスクの作成に失敗しました')
    }
  }, [projectId, onCreate])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sortedTasks.findIndex(task => task.id === active.id)
      const newIndex = sortedTasks.findIndex(task => task.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTasks = arrayMove(sortedTasks, oldIndex, newIndex)
        setSortedTasks(newTasks)

        const updates = newTasks.map((task, index) => 
          onUpdate(task.id, { order: index })
        )
        
        try {
          await Promise.all(updates)
        } catch (error) {
          console.error('Failed to update task order:', error)
          toast.error('タスクの並び替えに失敗しました')
        }
      }
    }
  }, [sortedTasks, onUpdate])

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-orange-600" />
        <h3 className="font-medium">フロータスク</h3>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="border rounded-lg overflow-hidden">
          <table ref={tableRef} className="w-full border-collapse editable-table">
            <thead>
              <tr className="border-b">
                {COLUMNS.map(column => (
                  <th key={column.key} className="text-left font-medium text-muted-foreground px-2 py-2 text-sm" style={{ width: column.width }}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTasks.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-8 text-muted-foreground">
                    <p>フロータスクがありません</p>
                    <p className="text-sm mt-1">下の行に入力して新しいタスクを追加できます</p>
                  </td>
                </tr>
              )}
              <SortableContext
                items={sortedTasks.map(task => task.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedTasks.map((task, index) => (
                  <SortableRow
                    key={task.id}
                    task={task}
                    rowIndex={index}
                    focusedCell={focusedCell}
                    selectedRows={selectedRows}
                    onToggleRowSelection={toggleRowSelection}
                    onUpdateCellValue={updateCellValue}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    onKeyDown={handleKeyDown}
                    onFocus={(row, col) => setFocusedCell({ row, col })}
                    cellRefs={cellRefs}
                    getCellKey={getCellKey}
                  />
                ))}
              </SortableContext>
              <NewTaskRow
                onCreateTask={handleCreateTask}
                focusedCell={focusedCell}
                onKeyDown={handleKeyDown}
                onFocus={(row, col) => setFocusedCell({ row, col })}
                cellRefs={cellRefs}
                getCellKey={getCellKey}
                rowIndex={sortedTasks.length}
              />
            </tbody>
          </table>
        </div>
      </DndContext>
    </div>
  )
}