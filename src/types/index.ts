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
  status: 'planning' | 'active' | 'completed' | 'paused' | 'cancelled'
  version: number
  estimated_total_hours?: number
}

export interface BigTask extends DatabaseEntity {
  project_id: string
  user_id: string
  name: string
  category: string
  week_number: number
  estimated_hours: number
  actual_hours?: number
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  description?: string
}

export interface SmallTask extends DatabaseEntity {
  big_task_id: string
  user_id: string
  name: string
  estimated_minutes: number
  scheduled_start: string
  scheduled_end: string
  actual_start?: string
  actual_end?: string
  actual_minutes?: number
  focus_level?: number
  notes?: string
  is_emergency?: boolean
  variance_ratio?: number
  description?: string
}

export interface WorkSession extends DatabaseEntity {
  small_task_id?: string
  user_id: string
  start_time: string
  end_time?: string
  duration_minutes: number
  focus_level?: number
  mood_notes?: string
  is_synced: boolean
}

export interface MoodEntry extends DatabaseEntity {
  user_id: string
  timestamp: string
  mood_level: number
  notes?: string
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

export interface SyncOperation extends DatabaseEntity {
  operation_id: string
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE'
  entity_type: 'project' | 'big_task' | 'small_task' | 'work_session' | 'mood_entry' | 'daily_condition' | 'category_color'
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
  operation: 'create' | 'update' | 'delete'
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

export type CreateWorkSessionData = Omit<WorkSession, 'id' | 'created_at' | 'updated_at'>
export type UpdateWorkSessionData = Partial<Omit<WorkSession, 'id' | 'created_at'>>

export type CreateMoodEntryData = Omit<MoodEntry, 'id' | 'created_at' | 'updated_at'>
export type UpdateMoodEntryData = Partial<Omit<MoodEntry, 'id' | 'created_at'>>

export type CreateCategoryColorData = Omit<CategoryColor, 'id' | 'created_at' | 'updated_at'>
export type UpdateCategoryColorData = Partial<Omit<CategoryColor, 'id' | 'created_at'>>

export type CreateDailyConditionData = Omit<DailyCondition, 'id' | 'created_at' | 'updated_at'>
export type UpdateDailyConditionData = Partial<Omit<DailyCondition, 'id' | 'created_at'>>

export type CreateSyncOperationData = Omit<SyncOperation, 'id' | 'retry_count' | 'status' | 'created_at' | 'updated_at'>
export type CreateSyncQueueData = Omit<SyncQueueItem, 'id' | 'created_at' | 'updated_at'>

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
  planning: 'planning'
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
  daily_condition: 'daily_condition'
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
  getByWeekNumber(projectId: string, weekNumber: number): Promise<BigTask[]>
  getByStatus(projectId: string, status: BigTask['status']): Promise<BigTask[]>
}

export interface SmallTaskRepository extends RepositoryInterface<SmallTask> {
  getByBigTaskId(bigTaskId: string): Promise<SmallTask[]>
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<SmallTask[]>
  getScheduledForDate(userId: string, date: string): Promise<SmallTask[]>
  getEmergencyTasks(userId: string): Promise<SmallTask[]>
  getActiveTasks(userId: string): Promise<SmallTask[]>
  startTask(taskId: string, startTime?: string): Promise<SmallTask>
  completeTask(taskId: string, endTime?: string, focusLevel?: number): Promise<SmallTask>
}

export interface WorkSessionRepository extends RepositoryInterface<WorkSession> {
  getByTaskId(taskId: string): Promise<WorkSession[]>
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<WorkSession[]>
  getActiveSession(userId: string): Promise<WorkSession | undefined>
  getUnsyncedSessions(): Promise<WorkSession[]>
  getByUserId(userId: string): Promise<WorkSession[]>
  getSessionsForDate(userId: string, date: string): Promise<WorkSession[]>
  startSession(userId: string, taskId?: string, startTime?: string): Promise<WorkSession>
  endSession(sessionId: string, endTime?: string, focusLevel?: number): Promise<WorkSession>
  pauseSession(sessionId: string): Promise<WorkSession>
  resumeSession(sessionId: string): Promise<WorkSession>
  addMoodNotes(sessionId: string, moodNotes: string): Promise<WorkSession>
  updateFocusLevel(sessionId: string, focusLevel: number): Promise<WorkSession>
}

export interface MoodEntryRepository extends RepositoryInterface<MoodEntry> {
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<MoodEntry[]>
  getLatestEntry(userId: string): Promise<MoodEntry | undefined>
}

export interface DailyConditionRepository extends RepositoryInterface<DailyCondition> {
  getByDate(userId: string, date: string): Promise<DailyCondition | undefined>
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<DailyCondition[]>
  getUnsyncedConditions(): Promise<DailyCondition[]>
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