/**
 * Timer Page Component Tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { format, addDays, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import TimerPage from '../page'
import { SmallTask, Project, WorkSession } from '@/types'

// Mock modules
vi.mock('@/hooks/use-timer')
vi.mock('@/hooks/use-projects')
vi.mock('@/hooks/use-small-tasks')
vi.mock('@/hooks/use-weekly-total')
vi.mock('@/stores/timer-store')
vi.mock('@/lib/db/repositories')
vi.mock('@/components/timer/mood-dialog', () => ({
  MoodDialog: ({ open, onOpenChange }: any) => 
    open ? <div data-testid="mood-dialog">Mood Dialog</div> : null
}))
vi.mock('@/components/timer/dopamine-dialog', () => ({
  DopamineDialog: ({ open, onOpenChange }: any) => 
    open ? <div data-testid="dopamine-dialog">Dopamine Dialog</div> : null
}))
vi.mock('@/components/timer/focus-dialog', () => ({
  FocusDialog: ({ open, onOpenChange, onSubmit }: any) => 
    open ? (
      <div data-testid="focus-dialog">
        <button onClick={() => onSubmit(4)}>Submit Focus</button>
      </div>
    ) : null
}))
vi.mock('@/components/timer/unplanned-task-dialog', () => ({
  UnplannedTaskDialog: ({ open, onOpenChange, onConfirm }: any) => 
    open ? (
      <div data-testid="unplanned-task-dialog">
        <button onClick={() => onConfirm('緊急タスク')}>Confirm Task</button>
      </div>
    ) : null
}))
vi.mock('@/components/timer/combined-schedule-view', () => ({
  CombinedScheduleView: ({ tasks, sessions, onTaskClick, date }: any) => (
    <div data-testid="combined-schedule-view">
      <div>Date: {format(date, 'yyyy-MM-dd')}</div>
      {tasks.map((task: SmallTask) => (
        <div key={task.id} onClick={() => onTaskClick(task)}>
          {task.name}
        </div>
      ))}
    </div>
  )
}))
vi.mock('@/components/timer/work-progress-card', () => ({
  WorkProgressCard: ({ dayTasks, todaySessions, weeklyTotal, selectedDate }: any) => (
    <div data-testid="work-progress-card">
      <div>Tasks: {dayTasks.length}</div>
      <div>Sessions: {todaySessions.length}</div>
      <div>Weekly Total: {weeklyTotal}</div>
    </div>
  )
}))
vi.mock('@/components/timer/timer-task-display', () => ({
  TimerTaskDisplay: ({ smallTasks, projects, dayTasks, onUnplannedTaskClick, onTaskChange, unplannedTaskName }: any) => (
    <div data-testid="timer-task-display">
      <button onClick={onUnplannedTaskClick}>計画外タスク</button>
      {unplannedTaskName && <div>{unplannedTaskName}</div>}
    </div>
  )
}))
// Mock TimerControls separately to avoid require issues
let mockIsRunning = false
vi.mock('@/components/timer/timer-controls', () => ({
  TimerControls: ({ onStartTimer, onStopTimer, onMoodClick, onDopamineClick }: any) => {
    return (
      <div data-testid="timer-controls">
        {!mockIsRunning ? (
          <button onClick={() => onStartTimer()}>開始</button>
        ) : (
          <button onClick={onStopTimer}>停止</button>
        )}
        <button onClick={onMoodClick}>Mood</button>
        <button onClick={onDopamineClick}>Dopamine</button>
      </div>
    )
  }
}))

// Import mocked modules
import { useTimer } from '@/hooks/use-timer'
import { useProjects } from '@/hooks/use-projects'
import { useSmallTasksByDateRange } from '@/hooks/use-small-tasks'
import { useWeeklyTotal } from '@/hooks/use-weekly-total'
import { useTimerStore } from '@/stores/timer-store'
import { workSessionRepository } from '@/lib/db/repositories'

// Mock implementations
const mockUseTimer = useTimer as ReturnType<typeof vi.fn>
const mockUseProjects = useProjects as ReturnType<typeof vi.fn>
const mockUseSmallTasksByDateRange = useSmallTasksByDateRange as ReturnType<typeof vi.fn>
const mockUseWeeklyTotal = useWeeklyTotal as ReturnType<typeof vi.fn>
const mockUseTimerStore = useTimerStore as ReturnType<typeof vi.fn>
const mockWorkSessionRepository = workSessionRepository as any

// Test data factories
const createMockTask = (overrides: Partial<SmallTask> = {}): SmallTask => ({
  id: 'task-1',
  name: 'テストタスク',
  project_id: 'project-1',
  user_id: 'current-user',
  scheduled_start: new Date().toISOString(),
  scheduled_end: addDays(new Date(), 1).toISOString(),
  estimated_minutes: 60,
  actual_minutes: 0,
  status: 'pending',
  is_emergency: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_synced: false,
  ...overrides,
})

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  name: 'テストプロジェクト',
  goal: 'テスト用プロジェクトの目標',
  deadline: addDays(new Date(), 30).toISOString(),
  color: 'hsl(217, 91%, 60%)',
  user_id: 'current-user',
  status: 'active',
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_synced: false,
  ...overrides,
})

const createMockSession = (overrides: Partial<WorkSession> = {}): WorkSession => ({
  id: 'session-1',
  user_id: 'current-user',
  small_task_id: 'task-1',
  start_time: new Date().toISOString(),
  end_time: undefined,
  duration_seconds: 0,
  focus_level: undefined,
  mood_notes: undefined,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_synced: false,
  ...overrides,
})

describe('TimerPage', () => {
  const mockStartTimer = vi.fn()
  const mockEndTimer = vi.fn()
  const mockLoadTasks = vi.fn()
  const mockRefreshWeeklyTotal = vi.fn()
  const mockSetCurrentTask = vi.fn()
  const mockSetCurrentProject = vi.fn()
  const mockUpdate = vi.fn()
  const mockGetSessionsForDate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15 10:00:00'))

    // Default mock implementations
    mockUseTimer.mockReturnValue({
      startTimer: mockStartTimer,
      endTimer: mockEndTimer,
    })

    mockUseProjects.mockReturnValue({
      projects: [createMockProject()],
    })

    mockUseSmallTasksByDateRange.mockReturnValue({
      smallTasks: [createMockTask()],
      loadTasks: mockLoadTasks,
    })

    mockUseWeeklyTotal.mockReturnValue({
      weeklyTotalFormatted: '10時間30分',
      refresh: mockRefreshWeeklyTotal,
    })

    mockUseTimerStore.mockReturnValue({
      isRunning: false,
      activeSession: null,
      currentTask: null,
      setCurrentTask: mockSetCurrentTask,
      setCurrentProject: mockSetCurrentProject,
    })

    mockWorkSessionRepository.update = mockUpdate
    mockWorkSessionRepository.getSessionsForDate = mockGetSessionsForDate
    mockGetSessionsForDate.mockResolvedValue([])
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('コンポーネントのレンダリング', () => {
    it('初期状態で正しくレンダリングされる', async () => {
      mockIsRunning = false
      render(<TimerPage />)

      // ヘッダー要素の確認
      expect(screen.getByTestId('timer-task-display')).toBeInTheDocument()
      expect(screen.getByTestId('timer-controls')).toBeInTheDocument()

      // 作業進捗カードの確認
      expect(screen.getByTestId('work-progress-card')).toBeInTheDocument()
      expect(screen.getByText('Tasks: 1')).toBeInTheDocument()
      expect(screen.getByText('Sessions: 0')).toBeInTheDocument()
      expect(screen.getByText('Weekly Total: 10時間30分')).toBeInTheDocument()

      // スケジュールビューの確認
      expect(screen.getByTestId('combined-schedule-view')).toBeInTheDocument()
      expect(screen.getByText('今日のスケジュール')).toBeInTheDocument()
    })

    it('アクティブセッションがある場合、タイマーが実行中として表示される', () => {
      const activeSession = createMockSession()
      mockIsRunning = true
      mockUseTimerStore.mockReturnValue({
        isRunning: true,
        activeSession,
        currentTask: createMockTask(),
        setCurrentTask: mockSetCurrentTask,
        setCurrentProject: mockSetCurrentProject,
      })

      render(<TimerPage />)

      expect(screen.getByText('停止')).toBeInTheDocument()
      expect(screen.queryByText('開始')).not.toBeInTheDocument()
    })
  })

  describe('タイマー機能', () => {
    it('タスクを選択してタイマーを開始できる', async () => {
      mockIsRunning = false
      render(<TimerPage />)

      const startButton = screen.getByText('開始')
      fireEvent.click(startButton)

      expect(mockStartTimer).toHaveBeenCalledWith({ taskId: undefined })

      // セッションの再読み込みを確認
      await vi.advanceTimersByTimeAsync(100)
      expect(mockGetSessionsForDate).toHaveBeenCalled()
    })

    it('計画外タスクでタイマーを開始できる', async () => {
      mockIsRunning = false
      render(<TimerPage />)

      // 計画外タスクボタンをクリック
      const unplannedButton = screen.getByText('計画外タスク')
      fireEvent.click(unplannedButton)

      // ダイアログが表示される
      expect(screen.getByTestId('unplanned-task-dialog')).toBeInTheDocument()

      // タスク名を確定
      const confirmButton = screen.getByText('Confirm Task')
      fireEvent.click(confirmButton)

      expect(mockStartTimer).toHaveBeenCalledWith({ taskDescription: '緊急タスク' })
    })

    it('タイマーを停止すると集中度ダイアログが表示される', async () => {
      mockIsRunning = true
      mockUseTimerStore.mockReturnValue({
        isRunning: true,
        activeSession: createMockSession(),
        currentTask: createMockTask(),
        setCurrentTask: mockSetCurrentTask,
        setCurrentProject: mockSetCurrentProject,
      })

      render(<TimerPage />)

      const stopButton = screen.getByText('停止')
      fireEvent.click(stopButton)

      // 集中度ダイアログが表示される
      expect(screen.getByTestId('focus-dialog')).toBeInTheDocument()

      // 集中度を送信
      const submitButton = screen.getByText('Submit Focus')
      fireEvent.click(submitButton)

      expect(mockEndTimer).toHaveBeenCalledWith({ focusLevel: 4 })

      // セッションと週間合計の更新を確認
      await vi.advanceTimersByTimeAsync(100)
      expect(mockGetSessionsForDate).toHaveBeenCalled()
      expect(mockRefreshWeeklyTotal).toHaveBeenCalled()
    })
  })

  describe('日付ナビゲーション', () => {
    it('前日に移動できる', () => {
      render(<TimerPage />)

      // Find the previous button by looking for the chevron-left icon's parent button
      const buttons = screen.getAllByRole('button')
      const prevButton = buttons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && svg.classList.contains('lucide-chevron-left')
      })

      if (prevButton) {
        fireEvent.click(prevButton)
      }

      // スケジュールビューに前日の日付が表示される
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
      expect(screen.getByText(`Date: ${yesterday}`)).toBeInTheDocument()
    })

    it('翌日に移動できる', () => {
      render(<TimerPage />)

      const buttons = screen.getAllByRole('button')
      const nextButton = buttons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && svg.classList.contains('lucide-chevron-right')
      })

      if (nextButton) {
        fireEvent.click(nextButton)
      }

      // スケジュールビューに翌日の日付が表示される
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
      expect(screen.getByText(`Date: ${tomorrow}`)).toBeInTheDocument()
    })

    it('今日ボタンで本日に戻れる', () => {
      render(<TimerPage />)

      // まず翌日に移動
      const buttons = screen.getAllByRole('button')
      const nextButton = buttons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && svg.classList.contains('lucide-chevron-right')
      })

      if (nextButton) {
        fireEvent.click(nextButton)
      }

      // 今日ボタンをクリック
      const todayButton = screen.getByText('今日')
      fireEvent.click(todayButton)

      // 本日の日付が表示される
      const today = format(new Date(), 'yyyy-MM-dd')
      expect(screen.getByText(`Date: ${today}`)).toBeInTheDocument()
    })
  })

  describe('ダイアログ操作', () => {
    it('感情記録ダイアログを開閉できる', () => {
      render(<TimerPage />)

      const moodButton = screen.getByText('Mood')
      fireEvent.click(moodButton)

      expect(screen.getByTestId('mood-dialog')).toBeInTheDocument()
    })

    it('ドーパミン記録ダイアログを開閉できる', () => {
      render(<TimerPage />)

      const dopamineButton = screen.getByText('Dopamine')
      fireEvent.click(dopamineButton)

      expect(screen.getByTestId('dopamine-dialog')).toBeInTheDocument()
    })
  })

  describe('タスク管理', () => {
    it('選択日のタスクが表示される', () => {
      const todayTask = createMockTask({ name: '今日のタスク' })
      const tomorrowTask = createMockTask({
        id: 'task-2',
        name: '明日のタスク',
        scheduled_start: addDays(new Date(), 1).toISOString(),
      })

      mockUseSmallTasksByDateRange.mockReturnValue({
        smallTasks: [todayTask, tomorrowTask],
        loadTasks: mockLoadTasks,
      })

      render(<TimerPage />)

      // 今日のタスクのみ表示される
      expect(screen.getByText('今日のタスク')).toBeInTheDocument()
      expect(screen.queryByText('明日のタスク')).not.toBeInTheDocument()
    })

    it('今日の日付でのみタスククリックでタイマーが開始される', () => {
      const task = createMockTask()
      mockUseSmallTasksByDateRange.mockReturnValue({
        smallTasks: [task],
        loadTasks: mockLoadTasks,
      })

      render(<TimerPage />)

      // 今日の日付でタスクをクリック
      const taskElement = screen.getByText('テストタスク')
      fireEvent.click(taskElement)

      expect(mockSetCurrentTask).toHaveBeenCalledWith(task)
      expect(mockSetCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'project-1' }))
      expect(mockStartTimer).toHaveBeenCalledWith({ taskId: 'task-1' })
    })
  })

  describe('セッション読み込み', () => {
    it('コンポーネントマウント時にセッションを読み込む', () => {
      render(<TimerPage />)

      expect(mockGetSessionsForDate).toHaveBeenCalledWith(
        'current-user',
        format(new Date(), 'yyyy-MM-dd')
      )
    })

    it('タイマー開始後にセッションを再読み込みする', async () => {
      mockIsRunning = false
      render(<TimerPage />)

      const startButton = screen.getByText('開始')
      fireEvent.click(startButton)

      await vi.advanceTimersByTimeAsync(100)

      expect(mockGetSessionsForDate).toHaveBeenCalledTimes(2)
    })

    it('アクティブセッションのタスクを復元する', () => {
      const activeSession = createMockSession()
      const task = createMockTask()
      const project = createMockProject()

      mockUseTimerStore.mockReturnValue({
        isRunning: false,
        activeSession,
        currentTask: null,
        setCurrentTask: mockSetCurrentTask,
        setCurrentProject: mockSetCurrentProject,
      })

      mockUseSmallTasksByDateRange.mockReturnValue({
        smallTasks: [task],
        loadTasks: mockLoadTasks,
      })

      mockUseProjects.mockReturnValue({
        projects: [project],
      })

      render(<TimerPage />)

      expect(mockSetCurrentTask).toHaveBeenCalledWith(task)
      expect(mockSetCurrentProject).toHaveBeenCalledWith(project)
    })
  })

  describe('エラー処理', () => {
    it('セッション読み込みエラーをコンソールに出力する', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetSessionsForDate.mockRejectedValueOnce(new Error('Database error'))

      render(<TimerPage />)

      // Wait for the useEffect to trigger
      await vi.runOnlyPendingTimersAsync()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load sessions:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('タスクなしでもコンポーネントが正常に動作する', () => {
      mockUseSmallTasksByDateRange.mockReturnValue({
        smallTasks: [],
        loadTasks: mockLoadTasks,
      })

      render(<TimerPage />)

      expect(screen.getByText('Tasks: 0')).toBeInTheDocument()
      expect(screen.getByTestId('combined-schedule-view')).toBeInTheDocument()
    })

    it('プロジェクトなしでもコンポーネントが正常に動作する', () => {
      mockUseProjects.mockReturnValue({
        projects: [],
      })

      render(<TimerPage />)

      expect(screen.getByTestId('timer-controls')).toBeInTheDocument()
      expect(screen.getByTestId('work-progress-card')).toBeInTheDocument()
    })
  })
})