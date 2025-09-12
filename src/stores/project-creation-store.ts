/**
 * Project Creation Store - プロジェクト作成画面の状態管理
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { startOfWeek, differenceInWeeks } from 'date-fns'
import { FlowWork, RecurringWork } from '@/types'
import { IntegratedScheduler } from '@/lib/scheduling/integrated-scheduler'

export interface Task {
  id: string
  category: string
  name: string
  estimatedHours: number
  order: number
  week_start?: number
  week_end?: number
  task_type?: 'flow' | 'recurring'
  recurrence?: {
    frequency: 'weekly_1' | 'weekly_2' | 'weekly_3' | 'weekly_4' | 'weekly_5' | 'weekly_6' | 'weekly_7'
    hours_per_occurrence: number
  }
}

export interface RecurringTask {
  id: string
  name: string
  frequency: 'weekly_1' | 'weekly_2' | 'weekly_3' | 'weekly_4' | 'weekly_5' | 'weekly_6' | 'weekly_7' // 週1〜週7
  hours_per_occurrence: number // 1回あたりの時間
  order: number
}

export interface DailyAllocation {
  date: string // YYYY-MM-DD形式
  dayOfWeek: number // 0-6（日-土）
  isWorkday: boolean // 作業日かどうか
  availableHours: number // その日の作業可能時間
  allocatedTasks: Array<{
    taskId: string
    taskName: string
    allocatedHours: number
  }>
  totalAllocatedHours: number
  utilizationRate: number
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

export interface SchedulingResult {
  placements: Array<{
    id: string
    type: 'flow' | 'hard' | 'soft'
    title: string
    startDate: string
    endDate: string
    startTime?: string
    endTime?: string
    placed: boolean
    shifted?: boolean
    shiftAmount?: { hours: number; days: number }
  }>
  unplaced: RecurringWork[]
  conflicts: Array<{
    work1: string
    work2: string
    date: string
    time: string
  }>
  stats: {
    totalFlowHours: number
    totalRecurringHours: number
    utilizationRate: number
    conflictCount: number
  }
}

interface ProjectCreationState {
  // プロジェクト基本情報
  projectName: string
  goal: string
  startDate: Date
  endDate: Date
  totalWeeks: number
  projectColor: string

  // 投下可能時間の計算
  workableWeekdays: boolean[] // [月,火,水,木,金,土,日]の7要素配列
  weekdayHours: number[] // [月,火,水,木,金,土,日]の各曜日の作業時間（7要素配列）
  excludeHolidays: boolean // 祝日を作業不可日とするか
  holidayWorkHours: number // 祝日に作業する場合の時間
  weeklyAvailableHours: number

  // タスク一覧
  tasks: Task[]
  recurringTasks: RecurringTask[]  // 定期タスクを別管理
  totalTaskHours: number
  totalAvailableHours: number

  // カテゴリ管理
  projectCategories: string[]

  // タスク配分
  dailyAllocations: DailyAllocation[]
  taskSchedules: Map<string, { startDate: string; endDate: string }>
  weeklyAllocations: WeeklyAllocation[] // 後方互換性のため残す
  isOverCapacity: boolean

  // UI状態
  isCalculating: boolean
  validationErrors: Record<string, string>

  // スケジューリング結果
  schedulingResult: SchedulingResult | null
}

interface ProjectCreationActions {
  // プロジェクト基本情報
  setProjectName: (name: string) => void
  setGoal: (goal: string) => void
  setStartDate: (date: Date) => void
  setEndDate: (date: Date) => void
  setProjectColor: (color: string) => void

  // 投下可能時間の計算
  setWorkableWeekdays: (weekdays: boolean[]) => void
  setWeekdayHours: (hours: number[]) => void
  setExcludeHolidays: (exclude: boolean) => void
  setHolidayWorkHours: (hours: number) => void

  // タスク一覧（フロータスク）
  initializeTasks: () => void
  addTask: () => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  reorderTasks: (startIndex: number, endIndex: number) => void
  updateTaskWeeks: (id: string, weekStart: number, weekEnd: number) => void
  
  // 定期タスク管理
  addRecurringTask: () => void
  updateRecurringTask: (id: string, updates: Partial<RecurringTask>) => void
  deleteRecurringTask: (id: string) => void

  // カテゴリ管理
  addCategory: (category: string) => void
  updateTaskCategory: (taskId: string, category: string) => void
  setCategoryColor: (category: string, color: string) => void
  loadCategoryColors: () => void

  // 計算
  calculateWeeklyHours: () => void
  calculateTaskAllocation: () => void
  calculateTotalWeeks: () => void

  // バリデーション
  validateForm: () => boolean
  getValidTasks: () => Task[]

  // カテゴリ選択
  selectCategories: (categories: string[]) => void

  // リセット
  reset: () => void

}

type ProjectCreationStore = ProjectCreationState & ProjectCreationActions

// 週の開始日を取得（日曜日始まり）
const getWeekStart = (date: Date): Date => {
  return startOfWeek(date, { weekStartsOn: 0 })
}

// 初期値
const initialState: ProjectCreationState = {
  // プロジェクト基本情報
  projectName: '',
  goal: '',
  startDate: new Date(),
  endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
  totalWeeks: 0,
  projectColor: 'hsl(137, 42%, 55%)', // デフォルトは緑

  // 投下可能時間の計算
  workableWeekdays: [true, true, true, true, true, false, false], // 月-金は作業、土日は休み
  weekdayHours: [2, 2, 2, 2, 2, 0, 0], // [月,火,水,木,金,土,日]の各曜日の作業時間
  excludeHolidays: true, // デフォルトで祝日は作業しない
  holidayWorkHours: 0,
  weeklyAvailableHours: 0,

  // タスク一覧
  tasks: [],
  totalTaskHours: 0,
  totalAvailableHours: 0,

  // カテゴリ管理
  projectCategories: ['企画・設計', 'デザイン', '実装', 'テスト', 'デプロイ'],

  // タスク配分
  dailyAllocations: [],
  taskSchedules: new Map(),
  weeklyAllocations: [],
  isOverCapacity: false,

  // UI状態
  isCalculating: false,
  validationErrors: {},

  // 定期タスク
  recurringTasks: [],
  // スケジューリング結果
  schedulingResult: null,
}

export const useProjectCreationStore = create<ProjectCreationStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // プロジェクト基本情報
      setProjectName: name => set({ projectName: name }),
      setGoal: goal => set({ goal }),
      setStartDate: date => {
        set({ startDate: date })
        get().calculateTotalWeeks()
        get().calculateTaskAllocation()
      },
      setEndDate: date => {
        set({ endDate: date })
        get().calculateTotalWeeks()
        get().calculateTaskAllocation()
      },
      setProjectColor: color => set({ projectColor: color }),

      // 投下可能時間の計算
      setWorkableWeekdays: weekdays => {
        set({ workableWeekdays: weekdays })
        // workableWeekdaysがfalseの曜日の時間を0にする
        const currentHours = get().weekdayHours
        const newHours = currentHours.map((hours, index) => 
          weekdays[index] ? hours : 0
        )
        set({ weekdayHours: newHours })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },
      setWeekdayHours: hours => {
        set({ weekdayHours: hours })
        // 時間が設定されている曜日のworkableWeekdaysをtrueにする
        const newWeekdays = hours.map(h => h > 0)
        set({ workableWeekdays: newWeekdays })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },
      setExcludeHolidays: exclude => {
        set({ excludeHolidays: exclude })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },
      setHolidayWorkHours: hours => {
        set({ holidayWorkHours: hours })
        get().calculateWeeklyHours()
        get().calculateTaskAllocation()
      },

      // タスク一覧
      initializeTasks: () => {
        // 初期タスクがない場合のみ、1つずつ作成
        if (get().tasks.length === 0) {
          const initialTasks: Task[] = [
            {
              id: `recurring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              category: '',
              name: '',
              estimatedHours: 0,
              order: 0,
              task_type: 'recurring',
              recurrence: {
                frequency: 'weekly_1',
                hours_per_occurrence: 0
              }
            },
            {
              id: `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              category: '',
              name: '',
              estimatedHours: 0,
              order: 1,
              task_type: 'flow'
            }
          ]
          set({ tasks: initialTasks })
        }
      },
      addTask: () => {
        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category: '',
          name: '',
          estimatedHours: 0,
          order: get().tasks.length,
        }
        set(state => ({
          tasks: [...state.tasks, newTask],
        }))
      },

      updateTask: (id, updates) => {
        set(state => ({
          tasks: state.tasks.map(task => (task.id === id ? { ...task, ...updates } : task)),
          totalTaskHours: state.tasks
            .map(task =>
              task.id === id ? (updates.estimatedHours ?? task.estimatedHours) : task.estimatedHours
            )
            .reduce((sum, hours) => sum + hours, 0),
        }))
        // 再計算
        get().calculateTaskAllocation()
      },

      deleteTask: id => {
        set(state => ({
          tasks: state.tasks.filter(task => task.id !== id),
          totalTaskHours: state.tasks
            .filter(task => task.id !== id)
            .reduce((sum, task) => sum + task.estimatedHours, 0),
        }))
        // 再計算
        get().calculateTaskAllocation()
      },

      reorderTasks: (startIndex, endIndex) => {
        if (startIndex === endIndex) return

        set(state => {
          const newTasks = Array.from(state.tasks)
          const [removed] = newTasks.splice(startIndex, 1)
          newTasks.splice(endIndex, 0, removed)

          // orderを更新
          const updatedTasks = newTasks.map((task, index) => ({
            ...task,
            order: index,
          }))

          return { tasks: updatedTasks }
        })
      },

      updateTaskWeeks: (id, weekStart, weekEnd) => {
        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === id ? { ...task, week_start: weekStart, week_end: weekEnd } : task
          ),
        }))
      },

      // カテゴリ管理
      addCategory: category => {
        const trimmedCategory = category.trim()
        if (trimmedCategory && !get().projectCategories.includes(trimmedCategory)) {
          set(state => ({
            projectCategories: [...state.projectCategories, trimmedCategory],
          }))
        }
      },

      updateTaskCategory: (taskId, category) => {
        set(state => ({
          tasks: state.tasks.map(task => (task.id === taskId ? { ...task, category } : task)),
        }))
      },

      setCategoryColor: (category, color) => {
        // カテゴリ色機能は削除
      },

      loadCategoryColors: () => {
        // カテゴリ色機能は削除
      },

      // 計算
      calculateWeeklyHours: () => {
        const { weekdayHours } = get()
        
        // 各曜日の作業時間を合計
        const weeklyHours = weekdayHours.reduce((sum, hours) => sum + hours, 0)
        
        set({ weeklyAvailableHours: weeklyHours })
      },

      calculateTotalWeeks: () => {
        const { startDate, endDate } = get()
        const weeks = differenceInWeeks(endDate, startDate) + 1
        set({
          totalWeeks: Math.max(1, weeks),
          totalAvailableHours: Math.max(1, weeks) * get().weeklyAvailableHours,
        })
      },

      calculateTaskAllocation: () => {
        const {
          tasks,
          startDate,
          endDate,
          weekdayHours,
          workableWeekdays,
          excludeHolidays,
          holidayWorkHours,
          totalWeeks,
        } = get()

        set({ isCalculating: true })

        try {
          // 有効なタスクのみ取得
          const validTasks = tasks.filter(task => task.name && task.estimatedHours > 0)
          if (validTasks.length === 0) {
            set({
              dailyAllocations: [],
              taskSchedules: new Map(),
              isOverCapacity: false,
              isCalculating: false,
            })
            return
          }

          // 日ごとの作業可能時間を計算
          const dailyAllocations: DailyAllocation[] = []
          const currentDate = new Date(startDate)
          const endDateMillis = new Date(endDate).getTime()

          while (currentDate.getTime() <= endDateMillis) {
            const dayOfWeek = currentDate.getDay()
            // dayOfWeek: 0=日, 1=月...6=土
            // weekdayHoursの配列インデックス: 0=月, 1=火...6=日
            const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
            
            const isWorkday = workableWeekdays[weekdayIndex]
            const availableHours = isWorkday ? weekdayHours[weekdayIndex] : 0

            dailyAllocations.push({
              date: currentDate.toISOString().split('T')[0],
              dayOfWeek,
              isWorkday,
              availableHours,
              allocatedTasks: [],
              totalAllocatedHours: 0,
              utilizationRate: 0,
            })

            currentDate.setDate(currentDate.getDate() + 1)
          }

          // タスクを日ごとに割り当て
          const taskSchedules = new Map<string, { startDate: string; endDate: string }>()
          let currentDayIndex = 0
          let remainingHoursInDay = dailyAllocations[currentDayIndex]?.availableHours || 0

          for (const task of validTasks) {
            let remainingTaskHours = task.estimatedHours
            const taskStartIndex = currentDayIndex

            while (remainingTaskHours > 0 && currentDayIndex < dailyAllocations.length) {
              const day = dailyAllocations[currentDayIndex]

              if (day.isWorkday && remainingHoursInDay > 0) {
                const hoursToAllocate = Math.min(remainingTaskHours, remainingHoursInDay)

                day.allocatedTasks.push({
                  taskId: task.id,
                  taskName: task.name,
                  allocatedHours: hoursToAllocate,
                })

                day.totalAllocatedHours += hoursToAllocate
                day.utilizationRate = (day.totalAllocatedHours / day.availableHours) * 100

                remainingTaskHours -= hoursToAllocate
                remainingHoursInDay -= hoursToAllocate
              }

              // 次の作業日へ
              if (remainingHoursInDay === 0 || !day.isWorkday) {
                currentDayIndex++
                if (currentDayIndex < dailyAllocations.length) {
                  remainingHoursInDay = dailyAllocations[currentDayIndex].availableHours
                }
              }
            }

            // タスクのスケジュールを記録
            if (taskStartIndex < dailyAllocations.length) {
              const endIndex = Math.min(currentDayIndex, dailyAllocations.length - 1)
              taskSchedules.set(task.id, {
                startDate: dailyAllocations[taskStartIndex].date,
                endDate: dailyAllocations[endIndex].date,
              })
            }
          }

          // 総タスク時間を計算（定期タスクの場合は週数を考慮）
          const totalTaskHours = validTasks.reduce((sum, task) => {
            if (task.task_type === 'recurring' && task.recurrence) {
              const frequency = task.recurrence.frequency
              const hoursPerOccurrence = task.recurrence.hours_per_occurrence || 0
              let occurrencesPerWeek = 0
              switch (frequency) {
                case 'weekly_7': occurrencesPerWeek = 7; break
                case 'weekly_6': occurrencesPerWeek = 6; break
                case 'weekly_5': occurrencesPerWeek = 5; break
                case 'weekly_4': occurrencesPerWeek = 4; break
                case 'weekly_3': occurrencesPerWeek = 3; break
                case 'weekly_2': occurrencesPerWeek = 2; break
                case 'weekly_1': occurrencesPerWeek = 1; break
              }
              return sum + (occurrencesPerWeek * totalWeeks * hoursPerOccurrence)
            }
            return sum + task.estimatedHours
          }, 0)
          const totalAvailableHours = dailyAllocations.reduce(
            (sum, day) => sum + day.availableHours,
            0
          )
          const isOverCapacity = totalTaskHours > totalAvailableHours

          set({
            dailyAllocations,
            taskSchedules,
            totalTaskHours,
            totalAvailableHours,
            isOverCapacity,
            isCalculating: false,
          })

          // 週次アロケーションも更新（後方互換性のため）
          const weeklyAllocations = generateWeeklyAllocations(
            dailyAllocations,
            startDate,
            totalWeeks
          )
          set({ weeklyAllocations })
        } catch (error) {
          console.error('タスク配分計算エラー:', error)
          set({ isCalculating: false })
        }
      },

      // バリデーション
      validateForm: () => {
        const errors: Record<string, string> = {}
        const { projectName, goal, endDate, startDate, tasks } = get()

        if (!projectName.trim()) {
          errors.projectName = 'プロジェクト名を入力してください'
        }
        if (!goal.trim()) {
          errors.goal = '定量目標を入力してください'
        }
        if (endDate < startDate) {
          errors.endDate = '期限は開始日より後の日付を選択してください'
        }

        // フロータスクと定期タスクを分けてチェック
        const validFlowTasks = tasks.filter(task => 
          task.task_type !== 'recurring' && 
          task.name.trim() && 
          task.estimatedHours > 0
        )
        const validRecurringTasks = tasks.filter(task => 
          task.task_type === 'recurring' && 
          task.name.trim() && 
          task.recurrence && 
          task.recurrence.hours_per_occurrence > 0
        )
        
        // どちらか一方でもあればOK
        if (validFlowTasks.length === 0 && validRecurringTasks.length === 0) {
          errors.tasks = 'フロータスクまたは定期タスクを最低1つ入力してください'
        }

        set({ validationErrors: errors })
        return Object.keys(errors).length === 0
      },

      getValidTasks: () => {
        return get().tasks.filter(task => {
          if (task.name.trim()) {
            if (task.task_type === 'recurring') {
              // 定期タスクの場合はrecurrenceが必要
              return task.recurrence && task.recurrence.hours_per_occurrence > 0
            } else {
              // フロータスクの場合はestimatedHoursが必要
              return task.estimatedHours > 0
            }
          }
          return false
        })
      },

      // カテゴリ選択
      selectCategories: categories => {
        const newCategories = categories.filter(cat => cat.trim() !== '')
        set({ projectCategories: newCategories })

        console.log('🎯 カテゴリ選択結果:')
        console.log('- 選択されたカテゴリ:', newCategories)
      },

      // リセット
      reset: () => {
        set({
          ...initialState,
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
          projectCategories: ['企画・設計', 'デザイン', '実装', 'テスト', 'デプロイ'],
        })
      },

      // 定期タスク管理
      addRecurringTask: () => {
        const newTask: RecurringTask = {
          id: `recurring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: '',
          frequency: 'weekly_1',
          hours_per_occurrence: 1,
          order: get().recurringTasks.length,
        }
        set((state) => ({
          recurringTasks: [...state.recurringTasks, newTask],
        }))
      },

      updateRecurringTask: (id, updates) => {
        set((state) => ({
          recurringTasks: state.recurringTasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }))
      },

      deleteRecurringTask: (id) => {
        set((state) => ({
          recurringTasks: state.recurringTasks.filter((task) => task.id !== id),
        }))
      },
    }),
    {
      name: 'project-creation-store',
    }
  )
)

// 週次アロケーションを生成（後方互換性のため）
function generateWeeklyAllocations(
  dailyAllocations: DailyAllocation[],
  startDate: Date,
  totalWeeks: number
): WeeklyAllocation[] {
  const weeklyAllocations: WeeklyAllocation[] = []

  // 週の情報を生成
  const currentWeekStart = getWeekStart(startDate)
  const endDateMillis = new Date(
    dailyAllocations[dailyAllocations.length - 1]?.date || startDate
  ).getTime()

  let weekIndex = 0
  const currentWeek = new Date(currentWeekStart)
  while (currentWeek.getTime() <= endDateMillis && weekIndex < totalWeeks) {
    const weekEnd = new Date(currentWeek)
    weekEnd.setDate(currentWeek.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // この週の日次アロケーションを集計
    const weekDays = dailyAllocations.filter(day => {
      const dayDate = new Date(day.date)
      return dayDate >= currentWeek && dayDate <= weekEnd
    })

    const weeklyAvailableHours = weekDays.reduce((sum, day) => sum + day.availableHours, 0)
    const allocatedTasks = new Map<string, { name: string; hours: number }>()

    weekDays.forEach(day => {
      day.allocatedTasks.forEach(task => {
        const existing = allocatedTasks.get(task.taskId)
        if (existing) {
          existing.hours += task.allocatedHours
        } else {
          allocatedTasks.set(task.taskId, {
            name: task.taskName,
            hours: task.allocatedHours,
          })
        }
      })
    })

    const totalAllocatedHours = Array.from(allocatedTasks.values()).reduce(
      (sum, task) => sum + task.hours,
      0
    )

    weeklyAllocations.push({
      weekNumber: weekIndex + 1,
      startDate: new Date(currentWeek),
      endDate: new Date(weekEnd),
      availableHours: weeklyAvailableHours,
      allocatedTasks: Array.from(allocatedTasks.entries()).map(([id, data]) => ({
        taskId: id,
        taskName: data.name,
        allocatedHours: data.hours,
        isPartial: false,
      })),
      totalAllocatedHours,
      utilizationRate:
        weeklyAvailableHours > 0 ? (totalAllocatedHours / weeklyAvailableHours) * 100 : 0,
    })

    currentWeek.setDate(currentWeek.getDate() + 7)
    weekIndex++
  }

  return weeklyAllocations
}
