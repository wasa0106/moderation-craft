// ======================
// エンティティ型定義（逆生成）
// ======================

// 基底型
export interface DatabaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface User extends DatabaseEntity {
  name: string;
  email: string;
  timezone: string;
  preferences: Record<string, unknown>;
}

export interface Project extends DatabaseEntity {
  user_id: string;
  name: string;
  goal: string;
  deadline: string;
  status: 'active' | 'completed';
  version: number;
  estimated_total_hours?: number;
  color?: string; // HSL形式: "hsl(137, 42%, 55%)"
}

export interface BigTask extends DatabaseEntity {
  project_id: string;
  user_id: string;
  name: string;
  estimated_hours: number;
  actual_hours: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  start_date: string;
  end_date: string;
  description?: string;
}

export interface SmallTask extends DatabaseEntity {
  big_task_id?: string;
  user_id: string;
  name: string;
  estimated_minutes: number;
  scheduled_start: string;
  scheduled_end: string;
  status?: 'pending' | 'completed' | 'cancelled';
  is_emergency?: boolean;
  description?: string;
  tags?: string[];
  project_id?: string;
  actual_minutes?: number;
  task_type?: 'project' | 'routine';
  is_reportable?: boolean;
}

export interface WorkSession extends DatabaseEntity {
  small_task_id?: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  focus_level?: number;
  mood_notes?: string;
  is_synced: boolean;
}

export interface MoodEntry extends DatabaseEntity {
  user_id: string;
  timestamp: string;
  mood_level: number;
  notes?: string;
}

export interface DopamineEntry extends DatabaseEntity {
  user_id: string;
  timestamp: string;
  event_description: string;
  notes?: string;
}

export interface DailyCondition extends DatabaseEntity {
  date: string;
  user_id: string;
  sleep_hours?: number;
  steps?: number;
  fitbit_sync_date?: string;
  subjective_mood?: 'excellent' | 'good' | 'fair' | 'poor';
  energy_level?: number;
  notes?: string;
}

export interface ScheduleMemo extends DatabaseEntity {
  user_id: string;
  week_start_date: string;
  content: string;
}

export interface SleepSchedule extends DatabaseEntity {
  user_id: string;
  date_of_sleep: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  scheduled_duration_minutes: number;
  actual_start_time?: string;
  actual_end_time?: string;
  actual_duration_minutes?: number;
  minutes_asleep?: number;
  minutes_awake?: number;
  time_in_bed?: number;
  sleep_efficiency?: number;
  actual_data_source?: 'manual' | 'fitbit' | 'import';
  actual_data_synced_at?: string;
  notes?: string;
}

export interface SyncQueueItem extends DatabaseEntity {
  user_id: string;
  entity_type: string;
  entity_id: string;
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  data?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempt_count: number;
  last_attempted?: string;
  error_message?: string;
  version: number;
}

// ======================
// API型定義
// ======================

export interface SyncRequest {
  entity_type: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
  syncedItem?: any;
  syncedEntityId?: string;
  syncedEntityType?: string;
}

export interface PullSyncResponse {
  success: boolean;
  data: {
    projects: Project[];
    bigTasks: BigTask[];
    smallTasks: SmallTask[];
    moodEntries: MoodEntry[];
    dopamineEntries: DopamineEntry[];
    workSessions: WorkSession[];
  };
  lastSyncTime: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ======================
// コンポーネントProps型
// ======================

export interface ProjectListProps {
  projects: Project[];
  onCreateProject?: () => void;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  onDuplicateProject?: (projectId: string) => void;
  onViewTasks?: (project: Project) => void;
  isLoading?: boolean;
  className?: string;
}

export interface TimerControlsProps {
  onStartTimer: (task?: SmallTask, taskDescription?: string) => void;
  onStopTimer: () => void;
  onMoodClick: () => void;
  onDopamineClick: () => void;
}

export interface TaskCardProps {
  task: SmallTask;
  projectName?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
  isActive?: boolean;
  className?: string;
}

// ======================
// ストア型定義
// ======================

export interface ProjectStore {
  selectedProjectId: string | null;
  selectedProjectName: string | null;
  selectedProjectColor: string | null;
  setSelectedProject: (id: string | null, name?: string | null, color?: string | null) => void;
  clearSelectedProject: () => void;
}

export interface TimerStore {
  isRunning: boolean;
  isPaused: boolean;
  startTime: number | null;
  pausedTime: number;
  elapsedTime: number;
  currentTask: SmallTask | null;
  currentSessionId: string | null;
  timerInterval: NodeJS.Timeout | null;
  startTimer: (task?: SmallTask, taskDescription?: string) => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  tick: () => void;
  reset: () => void;
}

export interface SyncStore {
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncErrors: string[];
  pendingOperations: number;
  setIsSyncing: (isSyncing: boolean) => void;
  setLastSyncTime: (time: string) => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;
  setPendingOperations: (count: number) => void;
  incrementPendingOperations: () => void;
  decrementPendingOperations: () => void;
}

// ======================
// リポジトリインターフェース
// ======================

export interface RepositoryInterface<T extends DatabaseEntity> {
  create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | undefined>;
  delete(id: string): Promise<boolean>;
  getById(id: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  count(): Promise<number>;
}

export interface ProjectRepository extends RepositoryInterface<Project> {
  getByUserId(userId: string): Promise<Project[]>;
  getActiveProjects(userId: string): Promise<Project[]>;
}

export interface BigTaskRepository extends RepositoryInterface<BigTask> {
  getByProjectId(projectId: string): Promise<BigTask[]>;
  getByWeekNumber(userId: string, weekNumber: number): Promise<BigTask[]>;
}

export interface SmallTaskRepository extends RepositoryInterface<SmallTask> {
  getByBigTaskId(bigTaskId: string): Promise<SmallTask[]>;
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<SmallTask[]>;
  getUnscheduledTasks(userId: string): Promise<SmallTask[]>;
  getEmergencyTasks(userId: string): Promise<SmallTask[]>;
}

// ======================
// ユーティリティ型
// ======================

export type CreateData<T extends DatabaseEntity> = Omit<T, 'id' | 'created_at' | 'updated_at'>;
export type UpdateData<T extends DatabaseEntity> = Partial<Omit<T, 'id' | 'created_at'>>;

export interface ScheduleBlock {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string;
  projectId: string;
  projectName: string;
  taskName: string;
  tags?: string[];
  color?: string;
}

export interface WeeklySchedule {
  weekStartDate: string;
  weekEndDate: string;
  scheduleBlocks: ScheduleBlock[];
  unscheduledTasks: SmallTask[];
}