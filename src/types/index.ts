/**
 * TypeScript type definitions for moderation-craft
 * Based on DEVELOPMENT_CONTEXT.md specifications
 */

export interface User extends DatabaseEntity {
  name: string
  email: string
  timezone: string
  preferences: Record<string, unknown>
}

export interface Project extends DatabaseEntity {
  user_id: string
  name: string
  goal: string
  deadline: string
  status: 'active' | 'completed'
  version: number
  estimated_total_hours?: number
  color?: string // HSL形式: "hsl(137, 42%, 55%)"
  workable_weekdays?: boolean[] // [月,火,水,木,金,土,日]の7要素配列
  weekday_hours?: number[] // [月,火,水,木,金,土,日]の各曜日の作業時間（7要素配列）
  exclude_holidays?: boolean // 祝日を作業不可日とするか
  holiday_work_hours?: number // 祝日に作業する場合の時間
}

export interface BigTask extends DatabaseEntity {
  project_id: string
  user_id: string
  name: string
  estimated_hours: number
  actual_hours: number
  status: 'active' | 'completed' | 'cancelled'
  category?: string // 任意のカテゴリ（例: 開発、設計、テスト、その他）
  start_date: string // YYYY-MM-DD形式
  end_date: string // YYYY-MM-DD形式
  order?: number // カンバンボードでの表示順
  task_type?: 'flow' | 'recurring' // タスクタイプ
  
  // 定期タスクフラグ
  is_recurring?: boolean // デフォルトはfalse（フロータスク）
  
  // 定期タスクの場合のみ使用
  recurrence?: {
    frequency: 'daily' | 'weekly_1' | 'weekly_2' | 'weekly_3' | 'weekly_4' | 'weekly_5' | 'weekly_6' | 'weekly_7' // 毎日、週1〜週7
    hours_per_occurrence: number // 1回あたりの時間
  }
}

// FlowWork定義（順繰り作業）
export interface FlowWork {
  id: string
  title: string
  estimatedMinutes: number
  notes?: string
  order: number
  dependencies?: string[] // 将来の拡張用
}

// RecurringWork定義（定期作業）
export interface RecurringWork {
  id: string
  title: string
  kind: 'hard' | 'soft' // hard=固定、soft=調整可能
  timezone: string // 'Asia/Tokyo'
  pattern: {
    freq: 'DAILY' | 'WEEKLY'
    byWeekday?: number[] // 0=Sun..6=Sat
  }
  rrule?: string // 将来の拡張用
  startTime: string // '09:30'
  durationMinutes: number
  startDate?: string
  endDate?: string | null
  exclusions?: string[] // 除外日リスト
  shiftLimits?: {
    hours: number // ±X時間までシフト可能
    days: number  // ±Y日までシフト可能
  }
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly'
  interval: number
  weekdays?: number[]
  start_date: string
  end_condition: {
    type: 'date' | 'count' | 'never'
    value?: string | number
  }
}

export interface SmallTask extends DatabaseEntity {
  big_task_id?: string
  user_id: string
  name: string
  estimated_minutes: number
  scheduled_start: string | null
  scheduled_end: string | null
  status?: SmallTaskStatus
  is_emergency?: boolean
  project_id?: string
  actual_minutes?: number
  task_type?: 'project' | 'routine'
  is_reportable?: boolean
  recurrence_enabled?: boolean
  recurrence_pattern?: RecurrencePattern
  recurrence_parent_id?: string
  order?: number
  kanban_column?: string
  // タスク詳細フィールド
  goal?: string // このタスクで実現したいこと
  dod?: string // 完了条件（Definition of Done）
  inputs?: string // 手元にある材料、情報
  outputs?: string // 成果物
  process?: string // 作業手順
  missing_inputs?: string // 不足している情報
  non_goals?: string // 今回はやらないこと
}

export interface WorkSession extends DatabaseEntity {
  small_task_id?: string
  user_id: string
  start_time: string
  end_time?: string
  duration_seconds: number
  focus_level?: number
  mood_notes?: string
  work_notes?: string
  is_synced: boolean
}

export interface TimeEntry extends DatabaseEntity {
  user_id: string
  small_task_id?: string
  project_id?: string
  big_task_id?: string
  
  date: string // YYYY-MM-DD
  start_time: string // ISO 8601
  end_time: string // ISO 8601
  duration_minutes: number
  
  description?: string
  notes?: string
  focus_level?: number
}

export interface MoodEntry extends DatabaseEntity {
  user_id: string
  timestamp: string
  mood_level: number
  notes?: string
}

export interface DopamineEntry extends DatabaseEntity {
  user_id: string
  timestamp: string
  event_description: string
}

export interface DailyCondition extends DatabaseEntity {
  date: string
  user_id: string
  sleep_hours?: number
  steps?: number
  fitbit_sync_date?: string
  subjective_mood?: 'excellent' | 'good' | 'fair' | 'poor'
  energy_level?: number
  notes?: string
}

export interface CategoryColor extends DatabaseEntity {
  user_id: string
  category_name: string
  color_code: string // hex形式 (#5E621B など)
}

export interface ScheduleMemo extends DatabaseEntity {
  user_id: string
  week_start_date: string // YYYY-MM-DD形式（週の開始日：月曜日）
  content: string // マークダウン形式のメモ内容
}

export interface SleepSchedule extends DatabaseEntity {
  user_id: string
  date_of_sleep: string // 起床日（YYYY-MM-DD）※Fitbit形式

  // 予定時刻（ISO 8601形式）
  scheduled_start_time: string // 就寝時刻
  scheduled_end_time: string // 起床時刻
  scheduled_duration_minutes: number

  // 実績（Fitbitから取得）
  actual_start_time?: string // 実際の就寝時刻
  actual_end_time?: string // 実際の起床時刻
  actual_duration_minutes?: number

  // Fitbitデータ
  minutes_asleep?: number // 実際に眠っていた時間
  minutes_awake?: number // 覚醒していた時間
  time_in_bed?: number // ベッドにいた総時間
  sleep_efficiency?: number // 睡眠効率（0-100）

  // データソース管理
  actual_data_source?: 'manual' | 'fitbit' | 'import'
  actual_data_synced_at?: string

  notes?: string
}

export interface SyncOperation extends DatabaseEntity {
  operation_id: string
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE'
  entity_type:
    | 'project'
    | 'big_task'
    | 'small_task'
    | 'work_session'
    | 'mood_entry'
    | 'dopamine_entry'
    | 'daily_condition'
    | 'category_color'
    | 'schedule_memo'
  entity_id: string
  payload: Record<string, unknown>
  timestamp: string
  retry_count: number
  max_retries: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  error_message?: string
}

export interface SyncQueueItem extends DatabaseEntity {
  user_id: string
  entity_type: string
  entity_id: string
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE'
  data?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempt_count: number
  last_attempted?: string
  error_message?: string
  version: number
}

export type CreateProjectData = Omit<Project, 'id' | 'created_at' | 'updated_at'>
export type UpdateProjectData = Partial<Omit<Project, 'id' | 'created_at'>>

export type CreateBigTaskData = Omit<BigTask, 'id' | 'created_at' | 'updated_at'>
export type UpdateBigTaskData = Partial<Omit<BigTask, 'id' | 'created_at'>>

export type CreateSmallTaskData = Omit<SmallTask, 'id' | 'created_at' | 'updated_at'>
export type UpdateSmallTaskData = Partial<Omit<SmallTask, 'id' | 'created_at'>>

export interface ScheduleBlock {
  id: string
  taskId: string
  startTime: string
  endTime: string
  projectId: string
  projectName: string
  taskName: string
  color?: string
  isRecurring?: boolean
}

export interface WeeklySchedule {
  weekStartDate: string
  weekEndDate: string
  scheduleBlocks: ScheduleBlock[]
  unscheduledTasks: SmallTask[]
}

export interface SmallTaskFormData {
  name: string
  estimated_minutes: number
  tags: string[]
  description?: string
}

export type CreateWorkSessionData = Omit<WorkSession, 'id' | 'created_at' | 'updated_at'>
export type UpdateWorkSessionData = Partial<Omit<WorkSession, 'id' | 'created_at'>>

export type CreateMoodEntryData = Omit<MoodEntry, 'id' | 'created_at' | 'updated_at'>
export type UpdateMoodEntryData = Partial<Omit<MoodEntry, 'id' | 'created_at'>>

export type CreateDopamineEntryData = Omit<DopamineEntry, 'id' | 'created_at' | 'updated_at'>
export type UpdateDopamineEntryData = Partial<Omit<DopamineEntry, 'id' | 'created_at'>>

export type CreateCategoryColorData = Omit<CategoryColor, 'id' | 'created_at' | 'updated_at'>
export type UpdateCategoryColorData = Partial<Omit<CategoryColor, 'id' | 'created_at'>>

export type CreateScheduleMemoData = Omit<ScheduleMemo, 'id' | 'created_at' | 'updated_at'>
export type UpdateScheduleMemoData = Partial<Omit<ScheduleMemo, 'id' | 'created_at'>>

export type CreateSleepScheduleData = Omit<SleepSchedule, 'id' | 'created_at' | 'updated_at'>
export type UpdateSleepScheduleData = Partial<Omit<SleepSchedule, 'id' | 'created_at'>>

export type CreateDailyConditionData = Omit<DailyCondition, 'id' | 'created_at' | 'updated_at'>
export type UpdateDailyConditionData = Partial<Omit<DailyCondition, 'id' | 'created_at'>>

export type CreateSyncOperationData = Omit<
  SyncOperation,
  'id' | 'retry_count' | 'status' | 'created_at' | 'updated_at'
>
export type CreateSyncQueueData = Omit<SyncQueueItem, 'id' | 'created_at' | 'updated_at'>

export type SmallTaskStatus = 'pending' | 'completed' | 'cancelled'

export interface DatabaseEntity {
  id: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface UserEntity extends DatabaseEntity {
  user_id: string
}

export interface TaskStatus {
  pending: 'pending'
  active: 'active'
  completed: 'completed'
}

export interface ProjectStatus {
  active: 'active'
  completed: 'completed'
}

export interface SyncStatus {
  pending: 'pending'
  syncing: 'syncing'
  completed: 'completed'
  failed: 'failed'
}

export interface OperationType {
  CREATE: 'CREATE'
  UPDATE: 'UPDATE'
  DELETE: 'DELETE'
}

export interface EntityType {
  project: 'project'
  big_task: 'big_task'
  small_task: 'small_task'
  work_session: 'work_session'
  mood_entry: 'mood_entry'
  dopamine_entry: 'dopamine_entry'
  daily_condition: 'daily_condition'
  schedule_memo: 'schedule_memo'
  sleep_schedule: 'sleep_schedule'
}

export interface SubjectiveMood {
  excellent: 'excellent'
  good: 'good'
  fair: 'fair'
  poor: 'poor'
}

export interface FocusLevel {
  min: 1
  max: 9
}

export interface MoodLevel {
  min: 1
  max: 9
}

export interface EnergyLevel {
  min: 1
  max: 5
}

export interface VarianceRatio {
  onTarget: { min: 0.8; max: 1.2 }
  overwork: { min: 1.2 }
  underwork: { max: 0.8 }
}

export interface TimerState {
  isRunning: boolean
  currentTaskId?: string
  elapsedMinutes: number
}

export interface OfflineCapability {
  isOnline: boolean
  pendingSyncCount: number
  lastSyncTime?: string
}

export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
  actions?: Array<{
    label: string
    action: () => void
  }>
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  timezone: string
  autoSyncInterval: number
  showVarianceColors: boolean
  defaultFocusLevel?: number
  workingHours: {
    start: string
    end: string
  }
  notifications: {
    enabled: boolean
    syncFailures: boolean
    taskReminders: boolean
  }
}

export interface DatabaseSchema {
  projects: string
  big_tasks: string
  small_tasks: string
  work_sessions: string
  mood_entries: string
  daily_conditions: string
  sync_queue: string
}

export interface RepositoryInterface<T extends DatabaseEntity> {
  create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>
  createWithId(data: T): Promise<T>
  getById(id: string): Promise<T | undefined>
  update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T>
  delete(id: string): Promise<void>
  list(filters?: Record<string, unknown>): Promise<T[]>
  count(filters?: Record<string, unknown>): Promise<number>
}

export interface SyncQueueRepository extends RepositoryInterface<SyncQueueItem> {
  getPending(): Promise<SyncQueueItem[]>
  getPendingItems(): Promise<SyncQueueItem[]>
  getAll(): Promise<SyncQueueItem[]>
  markAsCompleted(id: string): Promise<void>
  markAsFailed(id: string, error: string): Promise<void>
  incrementRetryCount(id: string): Promise<void>
  cleanupCompleted(olderThanDays?: number): Promise<number>
}

export interface ProjectRepository extends RepositoryInterface<Project> {
  getByUserId(userId: string): Promise<Project[]>
  getByStatus(status: Project['status']): Promise<Project[]>
  getActiveProjects(userId: string): Promise<Project[]>
}

export interface BigTaskRepository extends RepositoryInterface<BigTask> {
  getByProjectId(projectId: string): Promise<BigTask[]>
  getByStatus(projectId: string, status: BigTask['status']): Promise<BigTask[]>
}

export interface SmallTaskRepository extends RepositoryInterface<SmallTask> {
  getByBigTaskId(bigTaskId: string): Promise<SmallTask[]>
  getByProjectId(projectId: string): Promise<SmallTask[]>
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<SmallTask[]>
  getScheduledForDate(userId: string, date: string): Promise<SmallTask[]>
  getEmergencyTasks(userId: string): Promise<SmallTask[]>
  getActiveTasks(userId: string): Promise<SmallTask[]>
  startTask(taskId: string, startTime?: string): Promise<SmallTask>
  completeTask(taskId: string, endTime?: string, focusLevel?: number): Promise<SmallTask>
  updateOrder(taskId: string, order: number): Promise<SmallTask>
  updateKanbanColumn(taskId: string, column: string): Promise<SmallTask>
  reorderTasks(updates: Array<{ id: string; order: number }>): Promise<void>
}

export interface WorkSessionRepository extends RepositoryInterface<WorkSession> {
  getByTaskId(taskId: string): Promise<WorkSession[]>
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<WorkSession[]>
  getActiveSession(userId: string): Promise<WorkSession | undefined>
  getUnsyncedSessions(): Promise<WorkSession[]>
  getByUserId(userId: string): Promise<WorkSession[]>
  getSessionsForDate(userId: string, date: string): Promise<WorkSession[]>
  startSession(userId: string, taskId?: string, startTime?: string): Promise<WorkSession>
  endSession(sessionId: string, endTime?: string, focusLevel?: number, workNotes?: string): Promise<WorkSession | null>
  pauseSession(sessionId: string): Promise<WorkSession>
  resumeSession(sessionId: string): Promise<WorkSession>
  addMoodNotes(sessionId: string, moodNotes: string): Promise<WorkSession>
  updateFocusLevel(sessionId: string, focusLevel: number): Promise<WorkSession>
}

export interface MoodEntryRepository extends RepositoryInterface<MoodEntry> {
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<MoodEntry[]>
  getLatestEntry(userId: string): Promise<MoodEntry | undefined>
}

export interface DopamineEntryRepository extends RepositoryInterface<DopamineEntry> {
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<DopamineEntry[]>
  getLatestEntry(userId: string): Promise<DopamineEntry | undefined>
  getTodayEntries(userId: string): Promise<DopamineEntry[]>
}

export interface DailyConditionRepository extends RepositoryInterface<DailyCondition> {
  getByDate(userId: string, date: string): Promise<DailyCondition | undefined>
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<DailyCondition[]>
  getUnsyncedConditions(): Promise<DailyCondition[]>
}

export interface ScheduleMemoRepository extends RepositoryInterface<ScheduleMemo> {
  getByWeek(userId: string, weekStartDate: string): Promise<ScheduleMemo | undefined>
  upsertByWeek(userId: string, weekStartDate: string, content: string): Promise<ScheduleMemo>
  getRecent(userId: string, limit?: number): Promise<ScheduleMemo[]>
  searchByContent(userId: string, query: string): Promise<ScheduleMemo[]>
}

export interface SleepScheduleRepository extends RepositoryInterface<SleepSchedule> {
  getByDateOfSleep(userId: string, dateOfSleep: string): Promise<SleepSchedule | undefined>
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<SleepSchedule[]>
  upsertByDateOfSleep(
    userId: string,
    dateOfSleep: string,
    data: Partial<SleepSchedule>
  ): Promise<SleepSchedule>
  getRecentSchedules(userId: string, limit?: number): Promise<SleepSchedule[]>
}

export interface DatabaseOperations {
  generateId(): string
  getCurrentTimestamp(): string
  createTimestamps(): { created_at: string; updated_at: string }
  updateTimestamp(): { updated_at: string }
}

export interface OptimisticUpdateHandler<T> {
  applyOptimisticUpdate(data: T): void
  revertOptimisticUpdate(data: T): void
  confirmOptimisticUpdate(): void
}

export interface FitbitIntegration {
  clientId: string
  redirectUri: string
  scopes: ['sleep', 'activity']
  rateLimiting: 150
  syncSchedule: string
  endpoints: {
    sleep: string
    activity: string
  }
}

export interface FitbitData {
  sleep: {
    date: string
    duration: number
    efficiency: number
    startTime: string
    endTime: string
  }
  activity: {
    date: string
    steps: number
    distance: number
    caloriesOut: number
    activeMinutes: number
  }
}

export interface SyncManagerConfig {
  maxRetries: number
  retryDelay: number
  batchSize: number
  syncInterval: number
  conflictResolution: 'last-write-wins' | 'manual'
}

export interface ConflictResolutionStrategy {
  handleConflict<T>(local: T, remote: T): Promise<T>
  shouldRetry(error: Error): boolean
  getRetryDelay(attempt: number): number
}

// Store State Types
export interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  isLoading: boolean
  error: string | null
}

export interface TaskState {
  bigTasks: BigTask[]
  smallTasks: SmallTask[]
  activeTaskId: string | null
  isLoading: boolean
  error: string | null
}

export interface TimerStoreState {
  activeSession: WorkSession | null
  isRunning: boolean
  elapsedTime: number
  startTime: Date | null
  pausedTime: number
  focusLevel: number | null
  moodNotes: string
  isOffline: boolean
}

export interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  syncQueue: SyncQueueItem[]
  lastSyncTime: string | null
  syncErrors: string[]
  autoSyncEnabled: boolean
}
