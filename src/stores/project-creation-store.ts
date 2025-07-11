/**
 * Project Creation Store - プロジェクト作成画面の状態管理
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getDefaultColorForCategory, getNextColor, DEFAULT_CATEGORY_MAPPING, DEFAULT_CATEGORY_COLORS } from '@/lib/colors/category-colors'

// 完全なカラーパレット（重複防止用）
const COMPLETE_COLOR_PALETTE = [
  '#5E621B', // 0: 黄緑（Material Primary）
  '#3C6659', // 1: 緑（Material Tertiary）
  '#5F6044', // 2: 茶（Material Secondary）
  '#BA1A1A', // 3: 赤（Material Error）
  '#4A90E2', // 4: 青
  '#F5A623', // 5: オレンジ
  '#7ED321', // 6: 明るい緑
  '#9013FE', // 7: 紫
  '#50E3C2', // 8: ターコイズ
  '#F8E71C', // 9: 黄色
  '#B8E986', // 10: ライム
  '#BD10E0', // 11: マゼンタ
  '#FF6B6B', // 12: 明るい赤
  '#4ECDC4', // 13: ターコイズ
  '#45B7D1', // 14: 水色
  '#96CEB4', // 15: ミントグリーン
]

export interface Task {
  id: string
  category: string
  name: string
  estimatedHours: number
  order: number
}

export interface WeeklyAllocation {
  weekNumber: number
  startDate: Date
  endDate: Date
  availableHours: number
  allocatedTasks: Array<{
    taskId: string
    taskName: string
    allocatedHours: number
    isPartial: boolean
    partialSuffix?: string
  }>
  totalAllocatedHours: number
  utilizationRate: number
}

interface ProjectCreationState {
  // プロジェクト基本情報
  projectName: string
  goal: string
  startDate: Date
  endDate: Date
  totalWeeks: number

  // 投下可能時間の計算
  weekdayWorkDays: number // 0-5
  weekendWorkDays: number // 0-2
  weekdayHoursPerDay: number
  weekendHoursPerDay: number
  bufferRate: number // 50-100%
  weeklyAvailableHours: number

  // タスク一覧
  tasks: Task[]
  totalTaskHours: number
  
  // カテゴリ管理
  projectCategories: string[]
  categoryColors: Map<string, string>

  // 週別タスク配分
  weeklyAllocations: WeeklyAllocation[]
  isOverCapacity: boolean

  // UI状態
  isCalculating: boolean
  validationErrors: Record<string, string>
}

interface ProjectCreationActions {
  // プロジェクト基本情報
  setProjectName: (name: string) => void
  setGoal: (goal: string) => void
  setStartDate: (date: Date) => void
  setEndDate: (date: Date) => void

  // 投下可能時間の計算
  setWeekdayWorkDays: (days: number) => void
  setWeekendWorkDays: (days: number) => void
  setWeekdayHoursPerDay: (hours: number) => void
  setWeekendHoursPerDay: (hours: number) => void
  setBufferRate: (rate: number) => void

  // タスク一覧
  addTask: () => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  reorderTasks: (startIndex: number, endIndex: number) => void
  
  // カテゴリ管理
  addCategory: (category: string) => void
  updateTaskCategory: (taskId: string, category: string) => void
  setCategoryColor: (category: string, color: string) => void
  getCategoryColor: (category: string) => string
  loadCategoryColors: () => void

  // 計算
  calculateWeeklyHours: () => void
  calculateTaskAllocation: () => void
  calculateTotalWeeks: () => void

  // バリデーション
  validateForm: () => boolean
  getValidTasks: () => Task[]
  clearValidationErrors: () => void

  // リセット
  reset: () => void
}

type ProjectCreationStore = ProjectCreationState & ProjectCreationActions

const initialState: ProjectCreationState = {
  projectName: '',
  goal: '',
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後
  totalWeeks: 0,

  weekdayWorkDays: 5,
  weekendWorkDays: 0,
  weekdayHoursPerDay: 2,
  weekendHoursPerDay: 4,
  bufferRate: 80,
  weeklyAvailableHours: 0,

  tasks: [],
  totalTaskHours: 0,
  
  projectCategories: ['企画・設計', 'デザイン', '実装', 'テスト', 'デプロイ'],
  categoryColors: new Map([
    ['企画・設計', COMPLETE_COLOR_PALETTE[0]], // #5E621B
    ['デザイン', COMPLETE_COLOR_PALETTE[1]],     // #3C6659
    ['実装', COMPLETE_COLOR_PALETTE[2]],         // #5F6044
    ['テスト', COMPLETE_COLOR_PALETTE[3]],       // #BA1A1A
    ['デプロイ', COMPLETE_COLOR_PALETTE[4]],     // #4A90E2
  ]),

  weeklyAllocations: [],
  isOverCapacity: false,

  isCalculating: false,
  validationErrors: {},
}

export const useProjectCreationStore = create<ProjectCreationStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // プロジェクト基本情報
      setProjectName: (name) => {
        set({ projectName: name })
        get().clearValidationErrors()
      },

      setGoal: (goal) => {
        set({ goal })
        get().clearValidationErrors()
      },

      setStartDate: (date) => {
        set({ startDate: date })
        get().calculateTotalWeeks()
        get().calculateTaskAllocation()
      },

      setEndDate: (date) => {
        set({ endDate: date })
        get().calculateTotalWeeks()
        get().calculateTaskAllocation()
      },

      // 投下可能時間の計算
      setWeekdayWorkDays: (days) => {
        set({ weekdayWorkDays: days })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },

      setWeekendWorkDays: (days) => {
        set({ weekendWorkDays: days })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },

      setWeekdayHoursPerDay: (hours) => {
        set({ weekdayHoursPerDay: hours })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },

      setWeekendHoursPerDay: (hours) => {
        set({ weekendHoursPerDay: hours })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },

      setBufferRate: (rate) => {
        set({ bufferRate: rate })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },

      // タスク一覧
      addTask: () => {
        const newTask: Task = {
          id: crypto.randomUUID(),
          category: '',
          name: '',
          estimatedHours: 0,
          order: get().tasks.length,
        }
        set({ tasks: [...get().tasks, newTask] })
      },

      updateTask: (id, updates) => {
        const tasks = get().tasks.map(task => 
          task.id === id ? { ...task, ...updates } : task
        )
        set({ tasks })
        get().calculateTaskAllocation()
      },

      deleteTask: (id) => {
        const tasks = get().tasks.filter(task => task.id !== id)
        set({ tasks })
        get().calculateTaskAllocation()
      },

      reorderTasks: (startIndex, endIndex) => {
        const tasks = [...get().tasks]
        const [removed] = tasks.splice(startIndex, 1)
        tasks.splice(endIndex, 0, removed)
        
        // order を更新
        const updatedTasks = tasks.map((task, index) => ({
          ...task,
          order: index
        }))
        
        set({ tasks: updatedTasks })
        get().calculateTaskAllocation()
      },
      
      // カテゴリ管理
      addCategory: (category) => {
        const trimmedCategory = category.trim()
        if (trimmedCategory && !get().projectCategories.includes(trimmedCategory)) {
          console.log('➕ Adding new category:', trimmedCategory)
          set({ projectCategories: [...get().projectCategories, trimmedCategory] })
          
          // カテゴリ追加時に色を自動割り当て（getCategoryColorを使用して重複防止）
          const currentColors = get().categoryColors
          if (!currentColors.has(trimmedCategory)) {
            // getCategoryColorを呼び出して自動割り当て
            get().getCategoryColor(trimmedCategory)
          }
        }
      },

      updateTaskCategory: (taskId, category) => {
        const tasks = get().tasks.map(task => 
          task.id === taskId ? { ...task, category } : task
        )
        set({ tasks })
        
        // 新しいカテゴリの場合は追加
        get().addCategory(category)
        get().calculateTaskAllocation()
      },

      setCategoryColor: (category, color) => {
        const newColors = new Map(get().categoryColors)
        newColors.set(category, color)
        set({ categoryColors: newColors })
      },

      getCategoryColor: (category) => {
        console.log('🎨 Getting color for category:', category)
        
        const { categoryColors } = get()
        console.log('📊 Current categoryColors:', Array.from(categoryColors.entries()))
        
        if (!category) {
          console.log('⚠️ Empty category, returning gray')
          return '#999999' // 空の場合はグレー
        }
        
        if (categoryColors.has(category)) {
          const existingColor = categoryColors.get(category)!
          console.log('✅ Found existing color:', existingColor, 'for category:', category)
          return existingColor
        }
        
        // 新しいカテゴリに自動で色を割り当て
        const usedColors = new Set(categoryColors.values())
        console.log('🚫 Used colors:', Array.from(usedColors))
        
        // 使用されていない色を探す
        let newColor = null
        for (const color of COMPLETE_COLOR_PALETTE) {
          if (!usedColors.has(color)) {
            newColor = color
            break
          }
        }
        
        // すべての色が使用済みの場合
        if (!newColor) {
          const index = categoryColors.size % COMPLETE_COLOR_PALETTE.length
          newColor = COMPLETE_COLOR_PALETTE[index]
          console.log('🔄 All colors used, cycling with index:', index)
        }
        
        console.log('🆕 Assigning new color:', newColor, 'to category:', category)
        
        // 新しい色をマップに追加
        const newColors = new Map(categoryColors)
        newColors.set(category, newColor)
        set({ categoryColors: newColors })
        
        console.log('💾 Updated categoryColors:', Array.from(newColors.entries()))
        
        return newColor
      },

      loadCategoryColors: () => {
        const { projectCategories } = get()
        const newColors = new Map()
        
        // デフォルトカテゴリの色を設定
        projectCategories.forEach(category => {
          const defaultColor = getDefaultColorForCategory(category)
          newColors.set(category, defaultColor)
        })
        
        set({ categoryColors: newColors })
      },

      // 計算
      calculateWeeklyHours: () => {
        const { weekdayWorkDays, weekendWorkDays, weekdayHoursPerDay, weekendHoursPerDay, bufferRate } = get()
        
        const weeklyHours = (weekdayWorkDays * weekdayHoursPerDay + weekendWorkDays * weekendHoursPerDay) * (bufferRate / 100)
        
        set({ weeklyAvailableHours: Number(weeklyHours.toFixed(1)) })
      },

      calculateTaskAllocation: () => {
        const { weeklyAvailableHours, totalWeeks } = get()
        const validTasks = get().getValidTasks()
        
        if (validTasks.length === 0 || weeklyAvailableHours === 0 || totalWeeks === 0) {
          set({ 
            weeklyAllocations: [], 
            isOverCapacity: false,
            totalTaskHours: 0
          })
          return
        }

        const totalTaskHours = Number(validTasks.reduce((sum, task) => sum + task.estimatedHours, 0).toFixed(1))
        const totalAvailableHours = Number((weeklyAvailableHours * totalWeeks).toFixed(1))
        const isOverCapacity = totalTaskHours > totalAvailableHours

        // 週別配分を計算（有効なタスクのみ）
        const weeklyAllocations = allocateTasksToWeeks(validTasks, weeklyAvailableHours, totalWeeks, get().startDate)

        set({ 
          weeklyAllocations,
          isOverCapacity,
          totalTaskHours
        })
      },

      calculateTotalWeeks: () => {
        const { startDate, endDate } = get()
        const diffTime = endDate.getTime() - startDate.getTime()
        const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
        set({ totalWeeks: Math.max(1, diffWeeks) })
      },

      // バリデーション
      validateForm: () => {
        const { projectName, goal, startDate, endDate, tasks } = get()
        const errors: Record<string, string> = {}

        if (!projectName.trim()) {
          errors.projectName = 'プロジェクト名は必須です'
        }

        if (!goal.trim()) {
          errors.goal = '定量目標は必須です'
        }

        if (endDate <= startDate) {
          errors.endDate = '期限は開始日より後の日付を選択してください'
        }

        // 有効なタスクが1つもない場合
        const validTasks = tasks.filter(task => 
          task.name.trim() && task.estimatedHours > 0
        )
        if (validTasks.length === 0) {
          errors.tasks = '少なくとも1つの有効なタスクを追加してください'
        }

        set({ validationErrors: errors })
        return Object.keys(errors).length === 0
      },

      // 有効なタスクのみを取得
      getValidTasks: () => {
        const { tasks } = get()
        return tasks.filter(task => 
          task.name.trim() && task.estimatedHours > 0
        )
      },

      clearValidationErrors: () => {
        set({ validationErrors: {} })
      },

      // リセット
      reset: () => {
        const resetState = {
          ...initialState,
          projectCategories: ['企画・設計', 'デザイン', '実装', 'テスト', 'デプロイ'], // デフォルトカテゴリをリセット
          categoryColors: new Map([
            ['企画・設計', COMPLETE_COLOR_PALETTE[0]], // #5E621B
            ['デザイン', COMPLETE_COLOR_PALETTE[1]],     // #3C6659
            ['実装', COMPLETE_COLOR_PALETTE[2]],         // #5F6044
            ['テスト', COMPLETE_COLOR_PALETTE[3]],       // #BA1A1A
            ['デプロイ', COMPLETE_COLOR_PALETTE[4]],     // #4A90E2
          ])
        }
        set(resetState)
      },
    }),
    {
      name: 'project-creation-store',
    }
  )
)

// タスク配分アルゴリズム
function allocateTasksToWeeks(
  tasks: Task[],
  weeklyHours: number,
  totalWeeks: number,
  startDate: Date
): WeeklyAllocation[] {
  const allocations: WeeklyAllocation[] = []
  
  // 週の情報を生成
  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = new Date(startDate)
    weekStart.setDate(startDate.getDate() + week * 7)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    
    allocations.push({
      weekNumber: week + 1,
      startDate: weekStart,
      endDate: weekEnd,
      availableHours: weeklyHours,
      allocatedTasks: [],
      totalAllocatedHours: 0,
      utilizationRate: 0,
    })
  }
  
  // タスクを週に配分
  let currentWeekIndex = 0
  let remainingWeeklyHours = weeklyHours
  
  for (const task of tasks) {
    let remainingTaskHours = task.estimatedHours
    let partCount = 0
    
    while (remainingTaskHours > 0 && currentWeekIndex < totalWeeks) {
      const allocation = allocations[currentWeekIndex]
      const hoursToAllocate = Math.min(remainingTaskHours, remainingWeeklyHours)
      
      if (hoursToAllocate > 0) {
        const isPartial = remainingTaskHours > remainingWeeklyHours || partCount > 0
        const taskName = isPartial && partCount > 0 ? `${task.name}（続き）` : task.name
        
        allocation.allocatedTasks.push({
          taskId: task.id,
          taskName,
          allocatedHours: Number(hoursToAllocate.toFixed(1)),
          isPartial,
          partialSuffix: isPartial && partCount > 0 ? '（続き）' : undefined
        })
        
        allocation.totalAllocatedHours = Number((allocation.totalAllocatedHours + hoursToAllocate).toFixed(1))
        remainingTaskHours -= hoursToAllocate
        remainingWeeklyHours -= hoursToAllocate
        partCount++
      }
      
      if (remainingWeeklyHours === 0) {
        currentWeekIndex++
        remainingWeeklyHours = weeklyHours
      }
    }
  }
  
  // 使用率を計算
  allocations.forEach(allocation => {
    allocation.utilizationRate = allocation.availableHours > 0 
      ? Number(((allocation.totalAllocatedHours / allocation.availableHours) * 100).toFixed(1))
      : 0
  })
  
  return allocations
}

// カテゴリ情報
export const TASK_CATEGORIES = {
  planning: { label: '企画・設計', color: 'bg-blue-100 text-blue-800' },
  design: { label: 'デザイン', color: 'bg-purple-100 text-purple-800' },
  implementation: { label: '実装', color: 'bg-green-100 text-green-800' },
  testing: { label: 'テスト', color: 'bg-yellow-100 text-yellow-800' },
  deployment: { label: 'デプロイ', color: 'bg-red-100 text-red-800' },
} as const