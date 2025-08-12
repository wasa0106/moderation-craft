/**
 * プロジェクト作成デバッグユーティリティ
 */

import { db } from '@/lib/db/database'
import { format } from 'date-fns'

export const projectCreationDebug = {
  /**
   * データベーススキーマの確認
   */
  async checkDatabaseSchema() {
    console.log('=== データベーススキーマ確認 ===')

    try {
      // データベースバージョン
      console.log('DBバージョン:', db.verno)

      // テーブル一覧
      console.log('\nテーブル一覧:')
      db.tables.forEach((table: any) => {
        console.log(`  - ${table.name}`)
      })

      // BigTasksテーブルのスキーマ
      const bigTasksTable = db.big_tasks
      console.log('\nbig_tasksテーブル:')
      console.log('  存在確認:', bigTasksTable ? 'OK' : 'NG')
      if (bigTasksTable && bigTasksTable.schema) {
        console.log('  プライマリキー:', bigTasksTable.schema.primKey)
        console.log('  インデックス:', bigTasksTable.schema.indexes)
      }

      // プロジェクトテーブルのスキーマ
      const projectsTable = db.projects
      console.log('\nprojectsテーブル:')
      console.log('  存在確認:', projectsTable ? 'OK' : 'NG')
      if (projectsTable && projectsTable.schema) {
        console.log('  プライマリキー:', projectsTable.schema.primKey)
        console.log('  インデックス:', projectsTable.schema.indexes)
      }
    } catch (error) {
      console.error('スキーマ確認エラー:', error)
    }
  },

  /**
   * プロジェクト作成のテスト
   */
  async testProjectCreation() {
    console.log('=== プロジェクト作成テスト ===')

    try {
      // テストプロジェクトデータ
      const testProject = {
        user_id: 'test-user',
        name: 'テストプロジェクト',
        goal: 'テスト目標',
        deadline: '2025-12-31',
        status: 'active' as const,
        version: 1,
        estimated_total_hours: 100,
      }

      console.log('作成するプロジェクト:', testProject)

      // プロジェクト作成を試行
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const projectWithMeta = {
        ...testProject,
        id,
        created_at: now,
        updated_at: now,
      }

      await db.projects.add(projectWithMeta)
      console.log('✅ プロジェクト作成成功:', id)

      // 作成したプロジェクトを確認
      const created = await db.projects.get(id)
      console.log('作成されたプロジェクト:', created)

      // クリーンアップ
      await db.projects.delete(id)
      console.log('テストプロジェクトを削除しました')

      return true
    } catch (error) {
      console.error('❌ プロジェクト作成エラー:', error)
      return false
    }
  },

  /**
   * BigTask作成のテスト
   */
  async testBigTaskCreation() {
    console.log('=== BigTask作成テスト ===')

    try {
      // テストBigTaskデータ
      const testBigTask = {
        project_id: 'test-project-id',
        user_id: 'test-user',
        name: 'テストBigTask',
        category: 'テスト',
        estimated_hours: 10,
        actual_hours: 0,
        status: 'active' as const,
        start_date: '2025-01-06',
        end_date: '2025-01-12',
      }

      console.log('作成するBigTask:', testBigTask)

      // BigTask作成を試行
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const bigTaskWithMeta = {
        ...testBigTask,
        id,
        created_at: now,
        updated_at: now,
      }

      await db.big_tasks.add(bigTaskWithMeta)
      console.log('✅ BigTask作成成功:', id)

      // 作成したBigTaskを確認
      const created = await db.big_tasks.get(id)
      console.log('作成されたBigTask:', created)

      // クリーンアップ
      await db.big_tasks.delete(id)
      console.log('テストBigTaskを削除しました')

      return true
    } catch (error) {
      console.error('❌ BigTask作成エラー:', error)
      if (error instanceof Error) {
        console.error('エラーメッセージ:', error.message)
        console.error('スタック:', error.stack)
      }
      return false
    }
  },

  /**
   * 週配分データの検証
   */
  validateWeeklyAllocations(allocations: any[]) {
    console.log('=== 週配分データ検証 ===')
    console.log('配分数:', allocations.length)

    allocations.forEach((allocation: any, index: number) => {
      console.log(`\n週${allocation.weekNumber}:`)
      console.log('  開始日:', allocation.startDate)
      console.log('  終了日:', allocation.endDate)
      console.log('  タスク数:', allocation.allocatedTasks.length)
      console.log('  合計時間:', allocation.totalAllocatedHours)

      // 日付の妥当性チェック
      const start = new Date(allocation.startDate)
      const end = new Date(allocation.endDate)

      if (isNaN(start.getTime())) {
        console.error(`  ❌ 開始日が無効: ${allocation.startDate}`)
      }
      if (isNaN(end.getTime())) {
        console.error(`  ❌ 終了日が無効: ${allocation.endDate}`)
      }
      if (start >= end) {
        console.error(`  ❌ 開始日が終了日以降`)
      }
    })
  },
}

// グローバルに公開
if (typeof window !== 'undefined') {
  ;(window as any).projectCreationDebug = projectCreationDebug
  console.log('🔧 Project creation debug utilities loaded!')
  console.log('  - projectCreationDebug.checkDatabaseSchema()')
  console.log('  - projectCreationDebug.testProjectCreation()')
  console.log('  - projectCreationDebug.testBigTaskCreation()')
}
