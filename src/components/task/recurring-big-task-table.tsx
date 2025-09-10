/**
 * RecurringBigTaskTable - 定期タスク専用のテーブルコンポーネント
 * 繰り返し実行するタスクの管理に特化
 */

'use client'

import { useState, useRef, useCallback, memo, useEffect } from 'react'
import { BigTask, UpdateBigTaskData, CreateBigTaskData } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, CheckCircle2, Circle, RefreshCw, Plus, CalendarDays, GripVertical, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface RecurringBigTaskTableProps {
  tasks: BigTask[]
  projectId: string
  totalWeeks: number
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
  { key: 'frequency', label: '頻度', width: '120px' },
  { key: 'hoursPerOccurrence', label: '時間/回', width: '100px' },
  { key: 'totalHours', label: '合計時間', width: '100px' },
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
  placeholder = '',
  className = '',
  min,
  max,
  step,
  inputRef,
}: BufferedInputProps) {
  const [localValue, setLocalValue] = useState(String(value))
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
    
    if (onBlur) {
      onBlur()
    }
  }, [localValue, onChange, type, onBlur])

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
      min={min}
      max={max}
      step={step}
    />
  )
})

// TaskRow component
interface TaskRowProps {
  task: BigTask
  rowIndex: number
  totalWeeks: number
  selectedRows: Set<string>
  focusedCell: CellPosition | null
  onToggleRowSelection: (taskId: string) => void
  onUpdateCellValue: (row: number, col: number, value: any) => void
  onDelete: (taskId: string) => void
  onStatusChange?: (taskId: string, status: 'completed' | 'active') => Promise<void>
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void
  onFocus: (row: number, col: number) => void
  cellRefs: React.RefObject<Map<string, HTMLElement>>
  getCellKey: (row: number, col: number) => string
}

const TaskRow = memo(function TaskRow({
  task,
  rowIndex,
  totalWeeks,
  selectedRows,
  focusedCell,
  onToggleRowSelection,
  onUpdateCellValue,
  onDelete,
  onStatusChange,
  onKeyDown,
  onFocus,
  cellRefs,
  getCellKey,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const getStatusColor = (status: BigTask['status']) => {
    switch (status) {
      case 'active':
        return 'text-blue-600'
      case 'completed':
        return 'text-green-600'
      case 'cancelled':
        return 'text-muted-foreground'
      default:
        return ''
    }
  }

  const calculateTotalHours = () => {
    if (!task.recurrence) return 0
    const frequency = task.recurrence.frequency
    const hoursPerOccurrence = task.recurrence.hours_per_occurrence || 0
    let occurrencesPerWeek = 0
    
    switch (frequency) {
      case 'daily': occurrencesPerWeek = 7; break
      case 'weekly_1': occurrencesPerWeek = 1; break
      case 'weekly_2': occurrencesPerWeek = 2; break
      case 'weekly_3': occurrencesPerWeek = 3; break
      case 'weekly_4': occurrencesPerWeek = 4; break
      case 'weekly_5': occurrencesPerWeek = 5; break
      case 'weekly_6': occurrencesPerWeek = 6; break
      case 'weekly_7': occurrencesPerWeek = 7; break
    }
    
    return occurrencesPerWeek * totalWeeks * hoursPerOccurrence
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily': return '毎日'
      case 'weekly_1': return '週1回'
      case 'weekly_2': return '週2回'
      case 'weekly_3': return '週3回'
      case 'weekly_4': return '週4回'
      case 'weekly_5': return '週5回'
      case 'weekly_6': return '週6回'
      case 'weekly_7': return '週7回'
      default: return frequency
    }
  }

  return (
    <tr className={`sortable-item ${selectedRows.has(task.id) ? 'bg-muted' : ''}`}>
      <td className="drag-handle">
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
        {isEditing ? (
          <BufferedInput
            inputRef={el => {
              if (el) cellRefs.current.set(getCellKey(rowIndex, 1), el)
            }}
            value={task.category || ''}
            onChange={value => onUpdateCellValue(rowIndex, 1, value)}
            onKeyDown={e => onKeyDown(e, rowIndex, 1)}
            onFocus={() => onFocus(rowIndex, 1)}
            placeholder="カテゴリ"
            className={`border-none bg-transparent cell-input ${
              focusedCell?.row === rowIndex && focusedCell?.col === 1 ? 'cell-focused' : ''
            }`}
          />
        ) : (
          <span className="px-2">{task.category || 'その他'}</span>
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
            className={`border-none bg-transparent cell-input font-medium ${
              focusedCell?.row === rowIndex && focusedCell?.col === 2 ? 'cell-focused' : ''
            }`}
          />
        ) : (
          <span className="px-2 font-medium">{task.name}</span>
        )}
      </td>

      <td>
        {isEditing ? (
          <Select
            value={task.recurrence?.frequency || 'weekly_2'}
            onValueChange={value => onUpdateCellValue(rowIndex, 3, value)}
          >
            <SelectTrigger className="h-8 border-none bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">毎日</SelectItem>
              <SelectItem value="weekly_1">週1回</SelectItem>
              <SelectItem value="weekly_2">週2回</SelectItem>
              <SelectItem value="weekly_3">週3回</SelectItem>
              <SelectItem value="weekly_4">週4回</SelectItem>
              <SelectItem value="weekly_5">週5回</SelectItem>
              <SelectItem value="weekly_6">週6回</SelectItem>
              <SelectItem value="weekly_7">週7回</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="px-2">{getFrequencyLabel(task.recurrence?.frequency || 'weekly_2')}</span>
        )}
      </td>

      <td>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <BufferedInput
              inputRef={el => {
                if (el) cellRefs.current.set(getCellKey(rowIndex, 4), el)
              }}
              type="number"
              value={task.recurrence?.hours_per_occurrence || 1}
              onChange={value => onUpdateCellValue(rowIndex, 4, value)}
              onKeyDown={e => onKeyDown(e, rowIndex, 4)}
              onFocus={() => onFocus(rowIndex, 4)}
              min={0}
              step={0.5}
              placeholder="1"
              className={`border-none bg-transparent cell-input text-right ${
                focusedCell?.row === rowIndex && focusedCell?.col === 4 ? 'cell-focused' : ''
              }`}
            />
            <span className="text-xs text-muted-foreground">h</span>
          </div>
        ) : (
          <div className="text-right px-2">
            {task.recurrence?.hours_per_occurrence || 1}h
          </div>
        )}
      </td>

      <td>
        <div className="text-right font-medium">
          {calculateTotalHours().toFixed(1)}h
        </div>
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
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
})

// NewTaskRow component
interface NewTaskRowProps {
  onCreateTask: (task: Partial<BigTask>) => void
  focusedCell: CellPosition | null
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void
  onFocus: (row: number, col: number) => void
  cellRefs: React.RefObject<Map<string, HTMLElement>>
  getCellKey: (row: number, col: number) => string
  rowIndex: number
}

const NewTaskRow = memo(function NewTaskRow({
  onCreateTask,
  focusedCell,
  onKeyDown,
  onFocus,
  cellRefs,
  getCellKey,
  rowIndex,
}: NewTaskRowProps) {
  const [newTask, setNewTask] = useState<Partial<BigTask>>({
    category: '',
    name: '',
    task_type: 'recurring',
    status: 'active',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    recurrence: {
      frequency: '',
      hours_per_occurrence: '',
    },
  })

  const handleUpdateField = (field: string, value: any) => {
    if (field === 'frequency') {
      setNewTask(prev => ({
        ...prev,
        recurrence: {
          ...prev.recurrence,
          frequency: value,
          hours_per_occurrence: prev.recurrence?.hours_per_occurrence || 1,
        },
      }))
    } else if (field === 'hours_per_occurrence') {
      setNewTask(prev => ({
        ...prev,
        recurrence: {
          ...prev.recurrence,
          frequency: prev.recurrence?.frequency || '',
          hours_per_occurrence: value,
        },
      }))
    } else {
      setNewTask(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleCreateTask = () => {
    if (newTask.name && newTask.name.trim()) {
      onCreateTask(newTask)
      // Reset form
      setNewTask({
        category: '',
        name: '',
        task_type: 'recurring',
        status: 'active',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd'),
        recurrence: {
          frequency: '',
          hours_per_occurrence: '',
        },
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, col: number) => {
    // Enterキーでの作成は無効化
    if (e.key === 'Enter') {
      e.preventDefault()
    } else {
      onKeyDown(e, rowIndex, col)
    }
  }

  return (
    <tr className="bg-muted/30">
      <td className="text-center">
        <Plus className="h-4 w-4 text-muted-foreground mx-auto" />
      </td>

      <td>
        <input type="checkbox" disabled className="rounded opacity-50" />
      </td>

      <td>
        <BufferedInput
          inputRef={el => {
            if (el) cellRefs.current.set(getCellKey(rowIndex, 2), el)
          }}
          value={newTask.category || ''}
          onChange={value => handleUpdateField('category', value)}
          onKeyDown={e => handleKeyDown(e, 2)}
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
            if (el) cellRefs.current.set(getCellKey(rowIndex, 3), el)
          }}
          value={newTask.name || ''}
          onChange={value => handleUpdateField('name', value)}
          onKeyDown={e => handleKeyDown(e, 3)}
          onFocus={() => onFocus(rowIndex, 3)}
          placeholder=""
          className={`border-none bg-transparent cell-input font-medium ${
            focusedCell?.row === rowIndex && focusedCell?.col === 3 ? 'cell-focused' : ''
          }`}
        />
      </td>

      <td>
        <Select
          value={newTask.recurrence?.frequency || ''}
          onValueChange={value => handleUpdateField('frequency', value)}
        >
          <SelectTrigger 
            className="h-8 border-none bg-transparent"
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault()
                e.stopPropagation()
                handleKeyDown(e, 4)
              }
            }}
            onFocus={() => onFocus(rowIndex, 4)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">毎日</SelectItem>
            <SelectItem value="weekly_1">週1回</SelectItem>
            <SelectItem value="weekly_2">週2回</SelectItem>
            <SelectItem value="weekly_3">週3回</SelectItem>
            <SelectItem value="weekly_4">週4回</SelectItem>
            <SelectItem value="weekly_5">週5回</SelectItem>
            <SelectItem value="weekly_6">週6回</SelectItem>
            <SelectItem value="weekly_7">週7回</SelectItem>
          </SelectContent>
        </Select>
      </td>

      <td>
        <div className="flex items-center gap-1">
          <BufferedInput
            inputRef={el => {
              if (el) cellRefs.current.set(getCellKey(rowIndex, 5), el)
            }}
            type="number"
            value={newTask.recurrence?.hours_per_occurrence || ''}
            onChange={value => handleUpdateField('hours_per_occurrence', value)}
            onKeyDown={e => handleKeyDown(e, 5)}
            onFocus={() => onFocus(rowIndex, 5)}
            min={0}
            step={0.5}
            placeholder=""
            className={`border-none bg-transparent cell-input text-right ${
              focusedCell?.row === rowIndex && focusedCell?.col === 5 ? 'cell-focused' : ''
            }`}
          />
          <span className="text-xs text-muted-foreground">h</span>
        </div>
      </td>

      <td>
        <div className="text-right text-muted-foreground">-</div>
      </td>

      <td>
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant="default"
            onClick={handleCreateTask}
            disabled={!newTask.name || !newTask.name.trim()}
            className="h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            登録
          </Button>
        </div>
      </td>
    </tr>
  )
})

export function RecurringBigTaskTable({
  tasks,
  projectId,
  totalWeeks,
  onUpdate,
  onCreate,
  onDelete,
  onStatusChange,
  isLoading,
}: RecurringBigTaskTableProps) {
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [sortedTasks, setSortedTasks] = useState<BigTask[]>([])
  
  const tableRef = useRef<HTMLTableElement>(null)
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Filter and sort tasks
  useEffect(() => {
    const recurringTasks = tasks.filter(t => t.task_type === 'recurring')
    setSortedTasks([...recurringTasks].sort((a, b) => {
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

  const getCellKey = (row: number, col: number) => `${row}-${col}`

  const focusCell = useCallback((row: number, col: number) => {
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
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, row: number, col: number) => {
    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          if (col > 1) {
            focusCell(row, col - 1)
          } else if (row > 0) {
            focusCell(row - 1, 4)
          }
        } else {
          if (col < 4) {
            focusCell(row, col + 1)
          } else if (row < sortedTasks.length) {
            focusCell(row + 1, 1)
          }
        }
        break
      case 'Enter':
        if (row < sortedTasks.length) {
          e.preventDefault()
          focusCell(row + 1, col)
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (row > 0) focusCell(row - 1, col)
        break
      case 'ArrowDown':
        e.preventDefault()
        if (row <= sortedTasks.length) focusCell(row + 1, col)
        break
      case 'ArrowLeft':
        if (col > 1) focusCell(row, col - 1)
        break
      case 'ArrowRight':
        if (col < 4) focusCell(row, col + 1)
        break
    }
  }, [focusCell, sortedTasks.length])

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

  const updateCellValue = useCallback((row: number, col: number, value: any) => {
    const task = sortedTasks[row]
    if (!task) return

    const updates: UpdateBigTaskData = {}

    switch (col) {
      case 1: // Category
        updates.category = value as string
        break
      case 2: // Name
        updates.name = value as string
        break
      case 3: // Frequency
        updates.recurrence = {
          ...task.recurrence,
          frequency: value,
          hours_per_occurrence: task.recurrence?.hours_per_occurrence || 1,
        }
        break
      case 4: // Hours per occurrence
        updates.recurrence = {
          ...task.recurrence,
          frequency: task.recurrence?.frequency || 'weekly_2',
          hours_per_occurrence: typeof value === 'number' ? value : parseFloat(value) || 1,
        }
        // Also update estimated_hours based on total
        const frequency = task.recurrence?.frequency || 'weekly_2'
        let occurrencesPerWeek = 0
        switch (frequency) {
          case 'daily': occurrencesPerWeek = 7; break
          case 'weekly_1': occurrencesPerWeek = 1; break
          case 'weekly_2': occurrencesPerWeek = 2; break
          case 'weekly_3': occurrencesPerWeek = 3; break
          case 'weekly_4': occurrencesPerWeek = 4; break
          case 'weekly_5': occurrencesPerWeek = 5; break
          case 'weekly_6': occurrencesPerWeek = 6; break
          case 'weekly_7': occurrencesPerWeek = 7; break
        }
        updates.estimated_hours = occurrencesPerWeek * totalWeeks * (typeof value === 'number' ? value : parseFloat(value) || 1)
        break
    }

    onUpdate(task.id, updates)
  }, [sortedTasks, onUpdate, totalWeeks])

  const handleCreateTask = useCallback((taskData: Partial<BigTask>) => {
    // Calculate estimated_hours from recurrence
    let estimatedHours = 0
    if (taskData.recurrence) {
      const frequency = taskData.recurrence.frequency || 'weekly_2'
      const hoursPerOccurrence = taskData.recurrence.hours_per_occurrence || 1
      let occurrencesPerWeek = 0
      
      switch (frequency) {
        case 'daily': occurrencesPerWeek = 7; break
        case 'weekly_1': occurrencesPerWeek = 1; break
        case 'weekly_2': occurrencesPerWeek = 2; break
        case 'weekly_3': occurrencesPerWeek = 3; break
        case 'weekly_4': occurrencesPerWeek = 4; break
        case 'weekly_5': occurrencesPerWeek = 5; break
        case 'weekly_6': occurrencesPerWeek = 6; break
        case 'weekly_7': occurrencesPerWeek = 7; break
      }
      
      estimatedHours = occurrencesPerWeek * totalWeeks * hoursPerOccurrence
    }

    const createData: CreateBigTaskData = {
      project_id: projectId,
      user_id: 'current-user',
      name: taskData.name || '',
      category: taskData.category || '',
      task_type: 'recurring',
      estimated_hours: estimatedHours,
      actual_hours: 0,
      status: taskData.status || 'active',
      start_date: taskData.start_date || format(new Date(), 'yyyy-MM-dd'),
      end_date: taskData.end_date || format(new Date(), 'yyyy-MM-dd'),
      recurrence: taskData.recurrence,
      version: 1,
    }
    onCreate(createData)
  }, [projectId, onCreate, totalWeeks])

  if (isLoading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium">定期タスク</h3>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <table ref={tableRef} className="editable-table w-full">
          <thead>
            <tr className="border-b">
              {COLUMNS.map(column => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className="text-left font-medium text-muted-foreground px-2 py-2 text-sm"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTasks.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-8 text-muted-foreground">
                  <p>定期タスクがありません</p>
                  <p className="text-sm mt-1">下の行に入力して新しいタスクを追加できます</p>
                </td>
              </tr>
            )}
            {sortedTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                rowIndex={index}
                totalWeeks={totalWeeks}
                selectedRows={selectedRows}
                focusedCell={focusedCell}
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
    </div>
  )
}