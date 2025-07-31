/**
 * Repository index - Central export for all repositories
 * Provides convenient access to all database repositories
 */

export { ProjectRepository, projectRepository } from './project-repository'
export {
  BigTaskRepository,
  SmallTaskRepository,
  bigTaskRepository,
  smallTaskRepository,
  taskRepository,
} from './task-repository'
export {
  WorkSessionRepository,
  workSessionRepository,
  sessionRepository,
} from './session-repository'
export { MoodEntryRepository, moodEntryRepository, moodRepository } from './mood-repository'
export { dopamineEntryRepository } from './dopamine-repository'
export {
  DailyConditionRepository,
  dailyConditionRepository,
  conditionRepository,
} from './condition-repository'
export { SyncQueueRepository, syncQueueRepository, syncRepository } from './sync-repository'
export { ScheduleMemoRepositoryImpl, scheduleMemoRepository } from './schedule-memo-repository'
export { SleepScheduleRepositoryImpl, sleepScheduleRepository } from './sleep-schedule-repository'
export { BaseRepository } from './base-repository'

import { projectRepository } from './project-repository'
import { bigTaskRepository, smallTaskRepository } from './task-repository'
import { workSessionRepository } from './session-repository'
import { moodEntryRepository } from './mood-repository'
import { dopamineEntryRepository } from './dopamine-repository'
import { dailyConditionRepository } from './condition-repository'
import { syncQueueRepository } from './sync-repository'
import { scheduleMemoRepository } from './schedule-memo-repository'
import { sleepScheduleRepository } from './sleep-schedule-repository'

export const repositories = {
  project: projectRepository,
  bigTask: bigTaskRepository,
  smallTask: smallTaskRepository,
  workSession: workSessionRepository,
  moodEntry: moodEntryRepository,
  dopamineEntry: dopamineEntryRepository,
  dailyCondition: dailyConditionRepository,
  syncQueue: syncQueueRepository,
  scheduleMemo: scheduleMemoRepository,
  sleepSchedule: sleepScheduleRepository,
}

export default repositories
