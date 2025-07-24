/**
 * 既存のBigTaskに日付範囲を追加するマイグレーションユーティリティ
 */

import { db } from '@/lib/db/database'
import { calculateWeekDateRange } from './date-range-utils'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export const migrationUtils = {
  /**
   * 既存のBigTaskに日付範囲を追加
   */
  async addDateRangesToExistingTasks() {
    console.log('=== BigTask日付範囲マイグレーション開始 ===')

    try {
      const projects = await db.projects.toArray()
      const bigTasks = await db.big_tasks.toArray()

      let updatedCount = 0
      let skippedCount = 0

      for (const task of bigTasks) {
        // 既に日付範囲がある場合はスキップ
        if (task.week_start_date && task.week_end_date) {
          skippedCount++
          continue
        }

        // プロジェクトを検索
        const project = projects.find(p => p.id === task.project_id)
        if (!project) {
          console.warn(`プロジェクトが見つかりません: ${task.project_id}`)
          continue
        }

        // 日付範囲を計算
        const dateRange = calculateWeekDateRange(project, task.week_number)

        console.log(`タスク更新: ${task.name}`)
        console.log(`  週番号: ${task.week_number}`)
        console.log(
          `  日付範囲: ${format(dateRange.start, 'yyyy-MM-dd')} - ${format(dateRange.end, 'yyyy-MM-dd')}`
        )

        // データベースを更新
        await db.big_tasks.update(task.id, {
          week_start_date: dateRange.start.toISOString(),
          week_end_date: dateRange.end.toISOString(),
          updated_at: new Date().toISOString(),
        })

        updatedCount++
      }

      console.log('\n=== マイグレーション完了 ===')
      console.log(`更新されたタスク: ${updatedCount}`)
      console.log(`スキップされたタスク: ${skippedCount}`)
      console.log(`合計タスク: ${bigTasks.length}`)

      return {
        updated: updatedCount,
        skipped: skippedCount,
        total: bigTasks.length,
      }
    } catch (error) {
      console.error('マイグレーションエラー:', error)
      throw error
    }
  },

  /**
   * マイグレーション状況を確認
   */
  async checkMigrationStatus() {
    console.log('=== 日付範囲マイグレーション状況 ===')

    try {
      const bigTasks = await db.big_tasks.toArray()

      const tasksWithDateRange = bigTasks.filter((t: any) => t.week_start_date && t.week_end_date)
      const tasksWithoutDateRange = bigTasks.filter((t: any) => !t.week_start_date || !t.week_end_date)

      console.log(`\n📊 統計:`)
      console.log(`  日付範囲あり: ${tasksWithDateRange.length}`)
      console.log(`  日付範囲なし: ${tasksWithoutDateRange.length}`)
      console.log(`  合計: ${bigTasks.length}`)

      if (tasksWithoutDateRange.length > 0) {
        console.log('\n⚠️  日付範囲がないタスク:')
        tasksWithoutDateRange.forEach((task: any) => {
          console.log(`  - ${task.name} (週番号: ${task.week_number})`)
        })

        console.log('\n💡 マイグレーションを実行するには:')
        console.log('  migrationUtils.addDateRangesToExistingTasks()')
      } else {
        console.log('\n✅ すべてのタスクに日付範囲が設定されています！')
      }

      return {
        withDateRange: tasksWithDateRange.length,
        withoutDateRange: tasksWithoutDateRange.length,
        total: bigTasks.length,
      }
    } catch (error) {
      console.error('状況確認エラー:', error)
      throw error
    }
  },
}

// グローバルに公開
if (typeof window !== 'undefined') {
  ;(window as any).migrationUtils = migrationUtils
  console.log('📅 Date range migration utilities loaded!')
  console.log('  - migrationUtils.checkMigrationStatus() - マイグレーション状況を確認')
  console.log('  - migrationUtils.addDateRangesToExistingTasks() - 既存タスクに日付範囲を追加')
}
