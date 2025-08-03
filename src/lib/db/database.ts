/**
 * Dexie database setup for moderation-craft
 * IndexedDB wrapper with offline-first design
 */

import Dexie, { Table } from 'dexie'
import {
  User,
  Project,
  BigTask,
  SmallTask,
  WorkSession,
  MoodEntry,
  DopamineEntry,
  DailyCondition,
  CategoryColor,
  ScheduleMemo,
  SleepSchedule,
  SyncQueueItem,
  DatabaseOperations,
} from '@/types'

export class ModerationCraftDatabase extends Dexie implements DatabaseOperations {
  users!: Table<User>
  projects!: Table<Project>
  big_tasks!: Table<BigTask>
  small_tasks!: Table<SmallTask>
  work_sessions!: Table<WorkSession>
  mood_entries!: Table<MoodEntry>
  dopamine_entries!: Table<DopamineEntry>
  daily_conditions!: Table<DailyCondition>
  category_colors!: Table<CategoryColor>
  schedule_memos!: Table<ScheduleMemo>
  sleep_schedules!: Table<SleepSchedule>
  sync_queue!: Table<SyncQueueItem>

  constructor() {
    super('ModerationCraftDB')

    // Version 1: Initial schema
    this.version(1).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline',
      big_tasks: 'id, project_id, user_id, week_number, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, scheduled_start, scheduled_end, status, is_emergency, updated_at',
      work_sessions: 'id, small_task_id, user_id, start_time, end_time, is_synced, created_at',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      sync_queue:
        '++id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count',
    })

    // Version 2: Add category field to big_tasks
    this.version(2)
      .stores({
        users: 'id, email, created_at, updated_at',
        projects: 'id, user_id, status, updated_at, deadline',
        big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
        small_tasks:
          'id, big_task_id, user_id, scheduled_start, scheduled_end, status, is_emergency, updated_at',
        work_sessions: 'id, small_task_id, user_id, start_time, end_time, is_synced, created_at',
        mood_entries: 'id, user_id, timestamp, mood_level, created_at',
        daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
        sync_queue:
          '++id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count',
      })
      .upgrade(tx => {
        // Add default category to existing big_tasks
        return tx
          .table('big_tasks')
          .toCollection()
          .modify(task => {
            if (!task.category) {
              task.category = 'その他'
            }
          })
      })

    // Version 3: Add category_colors table
    this.version(3).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline',
      big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, scheduled_start, scheduled_end, status, is_emergency, updated_at',
      work_sessions: 'id, small_task_id, user_id, start_time, end_time, is_synced, created_at',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
      sync_queue:
        '++id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count',
    })

    // Version 4: Add tags and task_no to small_tasks
    this.version(4)
      .stores({
        users: 'id, email, created_at, updated_at',
        projects: 'id, user_id, status, updated_at, deadline',
        big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
        small_tasks:
          'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
        work_sessions: 'id, small_task_id, user_id, start_time, end_time, is_synced, created_at',
        mood_entries: 'id, user_id, timestamp, mood_level, created_at',
        daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
        category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
        sync_queue:
          '++id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count',
      })
      .upgrade(tx => {
        // Add default values to existing small_tasks
        return tx
          .table('small_tasks')
          .toCollection()
          .modify(task => {
            if (!task.tags) {
              task.tags = []
            }
            if (!task.project_id) {
              task.project_id = ''
            }
          })
      })

    // Version 5: Add dopamine_entries table
    this.version(5).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline',
      big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
      work_sessions: 'id, small_task_id, user_id, start_time, end_time, is_synced, created_at',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
      sync_queue:
        '++id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count',
    })

    // Version 6: Fix sync_queue indices to include created_at
    this.version(6).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline',
      big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
      work_sessions: 'id, small_task_id, user_id, start_time, end_time, is_synced, created_at',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
      sync_queue:
        'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
    })

    // Version 7: Add status field to small_tasks for task state management
    this.version(7)
      .stores({
        users: 'id, email, created_at, updated_at',
        projects: 'id, user_id, status, updated_at, deadline',
        big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
        small_tasks:
          'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
        work_sessions: 'id, small_task_id, user_id, start_time, end_time, is_synced, created_at',
        mood_entries: 'id, user_id, timestamp, mood_level, created_at',
        dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
        daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
        category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
        sync_queue:
          'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
      })
      .upgrade(tx => {
        // Set default status 'pending' for all existing small_tasks
        return tx
          .table('small_tasks')
          .toCollection()
          .modify(task => {
            if (!task.status) {
              task.status = 'pending'
            }
          })
      })

    // Version 8: Migrate to duration_seconds only
    this.version(8)
      .stores({
        users: 'id, email, created_at, updated_at',
        projects: 'id, user_id, status, updated_at, deadline',
        big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
        small_tasks:
          'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
        work_sessions:
          'id, small_task_id, user_id, start_time, end_time, is_synced, created_at, duration_seconds',
        mood_entries: 'id, user_id, timestamp, mood_level, created_at',
        dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
        daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
        category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
        sync_queue:
          'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
      })
      .upgrade(tx => {
        // 既存のwork_sessionsをduration_secondsに移行
        return tx
          .table('work_sessions')
          .toCollection()
          .modify(session => {
            // duration_secondsが存在しない場合のみ移行
            if (session.duration_seconds === undefined) {
              // duration_minutesがある場合は変換、なければ0
              session.duration_seconds = session.duration_minutes
                ? session.duration_minutes * 60
                : 0
            }
            // duration_minutesフィールドを削除
            delete session.duration_minutes
          })
      })

    // Version 9: Add color field to projects
    this.version(9)
      .stores({
        users: 'id, email, created_at, updated_at',
        projects: 'id, user_id, status, updated_at, deadline, color',
        big_tasks: 'id, project_id, user_id, category, week_number, status, updated_at',
        small_tasks:
          'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
        work_sessions:
          'id, small_task_id, user_id, start_time, end_time, is_synced, created_at, duration_seconds',
        mood_entries: 'id, user_id, timestamp, mood_level, created_at',
        dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
        daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
        category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
        sync_queue:
          'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
      })
      .upgrade(tx => {
        // プリセットカラーのリスト
        const presetColors = [
          'hsl(137, 42%, 55%)', // 緑（デフォルト）
          'hsl(0, 42%, 55%)', // 赤
          'hsl(210, 42%, 55%)', // 青
          'hsl(270, 42%, 55%)', // 紫
          'hsl(30, 42%, 55%)', // オレンジ
          'hsl(60, 42%, 55%)', // 黄色
          'hsl(330, 42%, 55%)', // ピンク
          'hsl(180, 42%, 55%)', // シアン
          'hsl(300, 42%, 55%)', // マゼンタ
        ]

        // 既存のプロジェクトに色を割り当て
        return tx
          .table('projects')
          .toCollection()
          .modify((project: any) => {
            if (!project.color) {
              // ランダムに色を割り当て
              const randomIndex = Math.floor(Math.random() * presetColors.length)
              project.color = presetColors[randomIndex]
            }
          })
      })

    // Version 10: Remove week_number from big_tasks index
    this.version(10).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline, color',
      big_tasks: 'id, project_id, user_id, category, start_date, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
      work_sessions:
        'id, small_task_id, user_id, start_time, end_time, is_synced, created_at, duration_seconds',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
      sync_queue:
        'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
    })

    // Version 11: Add schedule_memos table
    this.version(11).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline, color',
      big_tasks: 'id, project_id, user_id, category, start_date, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
      work_sessions:
        'id, small_task_id, user_id, start_time, end_time, is_synced, created_at, duration_seconds',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
      schedule_memos: 'id, [user_id+week_start_date], created_at, updated_at',
      sync_queue:
        'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
    })

    // Version 12: Add sleep_schedules table
    this.version(12).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline, color',
      big_tasks: 'id, project_id, user_id, category, start_date, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
      work_sessions:
        'id, small_task_id, user_id, start_time, end_time, is_synced, created_at, duration_seconds',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
      schedule_memos: 'id, [user_id+week_start_date], created_at, updated_at',
      sleep_schedules:
        'id, [user_id+date_of_sleep], scheduled_start_time, scheduled_end_time, created_at, updated_at',
      sync_queue:
        'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
    })

    // Version 13: Add Fitbit data fields to sleep_schedules
    this.version(13)
      .stores({
        users: 'id, email, created_at, updated_at',
        projects: 'id, user_id, status, updated_at, deadline, color',
        big_tasks: 'id, project_id, user_id, category, start_date, status, updated_at',
        small_tasks:
          'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, updated_at, *tags',
        work_sessions:
          'id, small_task_id, user_id, start_time, end_time, is_synced, created_at, duration_seconds',
        mood_entries: 'id, user_id, timestamp, mood_level, created_at',
        dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
        daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
        category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
        schedule_memos: 'id, [user_id+week_start_date], created_at, updated_at',
        sleep_schedules:
          'id, [user_id+date_of_sleep], scheduled_start_time, scheduled_end_time, actual_data_source, created_at, updated_at',
        sync_queue:
          'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
      })
      .upgrade(tx => {
        // localStorageからデータを移行
        if (typeof window !== 'undefined') {
          const savedMemo = localStorage.getItem('weeklyScheduleMemo')
          if (savedMemo) {
            // 現在の週の開始日を計算
            const now = new Date()
            const dayOfWeek = now.getDay()
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() + diff)
            const weekStartStr = weekStart.toISOString().split('T')[0]

            // データを移行
            const memo = {
              id: crypto.randomUUID(),
              user_id: 'current-user', // 仮のユーザーID
              week_start_date: weekStartStr,
              content: savedMemo,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            // schedule_memosテーブルに追加
            tx.table('schedule_memos')
              .add(memo)
              .then(() => {
                // 移行成功後にlocalStorageをクリア
                localStorage.removeItem('weeklyScheduleMemo')
                console.log('Successfully migrated schedule memo from localStorage')
              })
              .catch(error => {
                console.error('Failed to migrate schedule memo:', error)
              })
          }
        }
      })

    // Version 14: Add task_type and is_reportable to small_tasks
    this.version(14).stores({
      users: 'id, email, created_at, updated_at',
      projects: 'id, user_id, status, updated_at, deadline, color',
      big_tasks: 'id, project_id, user_id, category, start_date, status, updated_at',
      small_tasks:
        'id, big_task_id, user_id, project_id, scheduled_start, scheduled_end, status, is_emergency, task_type, is_reportable, updated_at, *tags',
      work_sessions:
        'id, small_task_id, user_id, start_time, end_time, is_synced, created_at, duration_seconds',
      mood_entries: 'id, user_id, timestamp, mood_level, created_at',
      dopamine_entries: 'id, user_id, timestamp, event_description, created_at',
      daily_conditions: 'id, date, user_id, fitbit_sync_date, created_at',
      category_colors: 'id, user_id, category_name, color_code, created_at, updated_at',
      schedule_memos: 'id, [user_id+week_start_date], created_at, updated_at',
      sleep_schedules:
        'id, [user_id+date_of_sleep], scheduled_start_time, scheduled_end_time, actual_data_source, created_at, updated_at',
      sync_queue:
        'id, user_id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count, created_at, updated_at',
    })

    this.users.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
    })

    this.users.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.projects.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
      if (!obj.version) {
        obj.version = 1
      }
      if (!obj.color) {
        // デフォルトカラー（緑）を設定
        obj.color = 'hsl(137, 42%, 55%)'
      }
    })

    this.projects.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
      if ((modifications as any).version !== undefined) {
        ;(modifications as any).version = ((modifications as any).version || 0) + 1
      }
    })

    this.big_tasks.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
      if (!obj.actual_hours) {
        obj.actual_hours = 0
      }
      if (!obj.category) {
        obj.category = 'その他'
      }

      // start_date/end_dateのデフォルト値設定
      if (!obj.start_date || !obj.end_date) {
        // デフォルトとして今日から1週間の期間を設定
        const today = new Date()
        const nextWeek = new Date(today)
        nextWeek.setDate(nextWeek.getDate() + 7)

        if (!obj.start_date) {
          obj.start_date = today.toISOString().split('T')[0]
        }
        if (!obj.end_date) {
          obj.end_date = nextWeek.toISOString().split('T')[0]
        }
      }
    })

    this.big_tasks.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.small_tasks.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
      if (obj.is_emergency === undefined) {
        obj.is_emergency = false
      }
      if (!obj.tags) {
        obj.tags = []
      }
      if (!obj.project_id) {
        obj.project_id = ''
      }
      if (!obj.scheduled_start) {
        obj.scheduled_start = ''
      }
      if (!obj.scheduled_end) {
        obj.scheduled_end = ''
      }
      if (!obj.status) {
        obj.status = 'pending'
      }
      if (!obj.task_type) {
        obj.task_type = 'project'
      }
      if (obj.is_reportable === undefined) {
        obj.is_reportable = true
      }
    })

    this.small_tasks.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.work_sessions.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
      if (obj.is_synced === undefined) {
        obj.is_synced = false
      }
    })

    this.work_sessions.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()

      if ((modifications as any).start_time && (modifications as any).end_time) {
        const startTime = new Date((modifications as any).start_time)
        const endTime = new Date((modifications as any).end_time)
        ;(modifications as any).duration_minutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / (1000 * 60)
        )
      }
    })

    this.mood_entries.hook('creating', (primKey, obj) => {
      obj.created_at = this.getCurrentTimestamp()
      if (!obj.id) {
        obj.id = this.generateId()
      }
    })

    this.dopamine_entries.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
      if (!obj.timestamp) {
        obj.timestamp = this.getCurrentTimestamp()
      }
    })

    this.dopamine_entries.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.daily_conditions.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
    })

    this.category_colors.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
    })

    this.category_colors.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.sync_queue.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at

      // IDを生成（重要！）
      if (!obj.id) {
        obj.id = this.generateId()
      }

      // 以下は不要（SyncQueueItemには存在しない）
      // if (!obj.operation_id) {
      //   obj.operation_id = this.generateId()
      // }
      // if (!obj.timestamp) {
      //   obj.timestamp = this.getCurrentTimestamp()
      // }
      // if (!obj.retry_count) {
      //   obj.retry_count = 0
      // }
      // if (!obj.max_retries) {
      //   obj.max_retries = 3
      // }

      if (!obj.status) {
        obj.status = 'pending'
      }
      if (obj.attempt_count === undefined) {
        obj.attempt_count = 0
      }
      if (obj.version === undefined) {
        obj.version = 1
      }
    })

    this.sync_queue.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.daily_conditions.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.schedule_memos.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }
    })

    this.schedule_memos.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()
    })

    this.sleep_schedules.hook('creating', (primKey, obj) => {
      const timestamps = this.createTimestamps()
      obj.created_at = timestamps.created_at
      obj.updated_at = timestamps.updated_at
      if (!obj.id) {
        obj.id = this.generateId()
      }

      // 睡眠時間を計算（既に計算済みでない場合）
      if (!obj.scheduled_duration_minutes && obj.scheduled_start_time && obj.scheduled_end_time) {
        const startTime = new Date(obj.scheduled_start_time)
        const endTime = new Date(obj.scheduled_end_time)
        obj.scheduled_duration_minutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / (1000 * 60)
        )
      }
    })

    this.sleep_schedules.hook('updating', modifications => {
      ;(modifications as any).updated_at = this.getCurrentTimestamp()

      // 時刻が変更された場合は睡眠時間を再計算
      if ('scheduled_start_time' in modifications || 'scheduled_end_time' in modifications) {
        // リポジトリレベルで処理
      }
    })
  }

  generateId(): string {
    return crypto.randomUUID()
  }

  getCurrentTimestamp(): string {
    return new Date().toISOString()
  }

  createTimestamps(): { created_at: string; updated_at: string } {
    const timestamp = this.getCurrentTimestamp()
    return {
      created_at: timestamp,
      updated_at: timestamp,
    }
  }

  updateTimestamp(): { updated_at: string } {
    return {
      updated_at: this.getCurrentTimestamp(),
    }
  }

  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map(table => table.clear()))
    })
  }

  async exportData(): Promise<{
    users: User[]
    projects: Project[]
    big_tasks: BigTask[]
    small_tasks: SmallTask[]
    work_sessions: WorkSession[]
    mood_entries: MoodEntry[]
    dopamine_entries: DopamineEntry[]
    daily_conditions: DailyCondition[]
    schedule_memos: ScheduleMemo[]
    sleep_schedules: SleepSchedule[]
    sync_queue: SyncQueueItem[]
  }> {
    const [
      users,
      projects,
      big_tasks,
      small_tasks,
      work_sessions,
      mood_entries,
      dopamine_entries,
      daily_conditions,
      schedule_memos,
      sleep_schedules,
      sync_queue,
    ] = await Promise.all([
      this.users.toArray(),
      this.projects.toArray(),
      this.big_tasks.toArray(),
      this.small_tasks.toArray(),
      this.work_sessions.toArray(),
      this.mood_entries.toArray(),
      this.dopamine_entries.toArray(),
      this.daily_conditions.toArray(),
      this.schedule_memos.toArray(),
      this.sleep_schedules.toArray(),
      this.sync_queue.toArray(),
    ])

    return {
      users,
      projects,
      big_tasks,
      small_tasks,
      work_sessions,
      mood_entries,
      dopamine_entries,
      daily_conditions,
      schedule_memos,
      sleep_schedules,
      sync_queue,
    }
  }

  async importData(data: {
    users?: User[]
    projects?: Project[]
    big_tasks?: BigTask[]
    small_tasks?: SmallTask[]
    work_sessions?: WorkSession[]
    mood_entries?: MoodEntry[]
    dopamine_entries?: DopamineEntry[]
    daily_conditions?: DailyCondition[]
    schedule_memos?: ScheduleMemo[]
    sleep_schedules?: SleepSchedule[]
    sync_queue?: SyncQueueItem[]
  }): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      if (data.users) await this.users.bulkAdd(data.users)
      if (data.projects) await this.projects.bulkAdd(data.projects)
      if (data.big_tasks) await this.big_tasks.bulkAdd(data.big_tasks)
      if (data.small_tasks) await this.small_tasks.bulkAdd(data.small_tasks)
      if (data.work_sessions) await this.work_sessions.bulkAdd(data.work_sessions)
      if (data.mood_entries) await this.mood_entries.bulkAdd(data.mood_entries)
      if (data.dopamine_entries) await this.dopamine_entries.bulkAdd(data.dopamine_entries)
      if (data.daily_conditions) await this.daily_conditions.bulkAdd(data.daily_conditions)
      if (data.schedule_memos) await this.schedule_memos.bulkAdd(data.schedule_memos)
      if (data.sleep_schedules) await this.sleep_schedules.bulkAdd(data.sleep_schedules)
      if (data.sync_queue) await this.sync_queue.bulkAdd(data.sync_queue)
    })
  }

  async getUnsyncedItems(): Promise<{
    projects: Project[]
    big_tasks: BigTask[]
    small_tasks: SmallTask[]
    work_sessions: WorkSession[]
    mood_entries: MoodEntry[]
    dopamine_entries: DopamineEntry[]
    daily_conditions: DailyCondition[]
    schedule_memos: ScheduleMemo[]
    sleep_schedules: SleepSchedule[]
  }> {
    const unsyncedSessions = await this.work_sessions.where('is_synced').equals(0).toArray()

    const pendingSyncOperations = await this.sync_queue.where('status').equals('pending').toArray()

    const entityIds = {
      projects: new Set<string>(),
      big_tasks: new Set<string>(),
      small_tasks: new Set<string>(),
      work_sessions: new Set<string>(),
      mood_entries: new Set<string>(),
      dopamine_entries: new Set<string>(),
      daily_conditions: new Set<string>(),
      schedule_memos: new Set<string>(),
      sleep_schedules: new Set<string>(),
    }

    pendingSyncOperations.forEach(op => {
      if (op.entity_type in entityIds) {
        entityIds[op.entity_type as keyof typeof entityIds].add(op.entity_id)
      }
    })

    const [
      projects,
      big_tasks,
      small_tasks,
      work_sessions,
      mood_entries,
      dopamine_entries,
      daily_conditions,
      schedule_memos,
      sleep_schedules,
    ] = await Promise.all([
      this.projects.where('id').anyOf(Array.from(entityIds.projects)).toArray(),
      this.big_tasks.where('id').anyOf(Array.from(entityIds.big_tasks)).toArray(),
      this.small_tasks.where('id').anyOf(Array.from(entityIds.small_tasks)).toArray(),
      unsyncedSessions,
      this.mood_entries.where('id').anyOf(Array.from(entityIds.mood_entries)).toArray(),
      this.dopamine_entries.where('id').anyOf(Array.from(entityIds.dopamine_entries)).toArray(),
      this.daily_conditions.where('date').anyOf(Array.from(entityIds.daily_conditions)).toArray(),
      this.schedule_memos.where('id').anyOf(Array.from(entityIds.schedule_memos)).toArray(),
      this.sleep_schedules.where('id').anyOf(Array.from(entityIds.sleep_schedules)).toArray(),
    ])

    return {
      projects,
      big_tasks,
      small_tasks,
      work_sessions,
      mood_entries,
      dopamine_entries,
      daily_conditions,
      schedule_memos,
      sleep_schedules,
    }
  }

  async getDatabaseStats(): Promise<{
    totalRecords: number
    tableStats: Record<string, number>
    databaseSize: number
    lastUpdated: string
  }> {
    const tableStats = await Promise.all(
      this.tables.map(async table => ({
        name: table.name,
        count: await table.count(),
      }))
    )

    const totalRecords = tableStats.reduce((sum, table) => sum + table.count, 0)

    const tableStatsObject = tableStats.reduce(
      (acc, table) => {
        acc[table.name] = table.count
        return acc
      },
      {} as Record<string, number>
    )

    const lastUpdated = await this.projects
      .orderBy('updated_at')
      .reverse()
      .first()
      .then(project => project?.updated_at || this.getCurrentTimestamp())

    return {
      totalRecords,
      tableStats: tableStatsObject,
      databaseSize: 0,
      lastUpdated,
    }
  }

  async optimizeDatabase(): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - 6)
    const cutoffISOString = cutoffDate.toISOString()

    await this.transaction('rw', [this.sync_queue, this.mood_entries], async () => {
      await this.sync_queue
        .where('status')
        .equals('completed')
        .and(item => item.created_at < cutoffISOString)
        .delete()

      await this.mood_entries.where('created_at').below(cutoffISOString).delete()
    })
  }

  /**
   * 開発時用：データベースを完全にクリアして再作成
   * 本番環境では使用しない
   */
  async resetDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production')
    }

    try {
      await this.delete()
      console.log('Database deleted successfully')

      // 新しいデータベースを作成
      await this.open()
      console.log('New database created')
    } catch (error) {
      console.error('Failed to reset database:', error)
      throw error
    }
  }

  /**
   * スキーマエラー時の復旧処理
   */
  async handleSchemaError(): Promise<void> {
    try {
      console.warn('Schema error detected, attempting to recover...')

      // 既存データのバックアップを試行
      let backupData = null
      try {
        backupData = await this.exportData()
        console.log('Backup created successfully')
      } catch (backupError) {
        console.warn('Failed to create backup:', backupError)
      }

      // データベースをリセット
      await this.resetDatabase()

      // バックアップがある場合は復元を試行
      if (backupData) {
        try {
          await this.importData(backupData)
          console.log('Data restored from backup')
        } catch (restoreError) {
          console.error('Failed to restore from backup:', restoreError)
        }
      }

      console.log('Database recovery completed')
    } catch (error) {
      console.error('Database recovery failed:', error)
      throw error
    }
  }
}

export const db = new ModerationCraftDatabase()

export default db
