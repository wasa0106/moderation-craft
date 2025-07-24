/**
 * Debug utilities for checking data relationships
 */

import { db } from '@/lib/db/database'

export const debugUtils = {
  /**
   * BigTaskとProjectの紐付けをチェック
   */
  async checkBigTaskProjectRelations() {
    console.log('=== BigTask-Project Relations Debug ===')

    try {
      // 全プロジェクトを取得
      const projects = await db.projects.toArray()
      console.log('\n📋 Projects in database:')
      projects.forEach((p: any) => {
        console.log(`  - ${p.name} (ID: ${p.id})`)
      })

      // 全BigTaskを取得
      const bigTasks = await db.big_tasks.toArray()
      console.log(`\n📝 Total BigTasks: ${bigTasks.length}`)

      // 孤立したBigTaskをチェック
      const orphanedTasks: any[] = []
      const validTasks: any[] = []

      for (const task of bigTasks) {
        const project = projects.find(p => p.id === task.project_id)
        if (!project) {
          orphanedTasks.push(task)
          console.log(`\n❌ Orphaned BigTask found:`)
          console.log(`  - Name: ${task.name}`)
          console.log(`  - ID: ${task.id}`)
          console.log(`  - project_id: ${task.project_id} (NOT FOUND)`)
          console.log(`  - week_number: ${task.week_number}`)
        } else {
          validTasks.push({ task, project })
          console.log(`\n✅ Valid BigTask:`)
          console.log(`  - Name: ${task.name}`)
          console.log(`  - ID: ${task.id}`)
          console.log(`  - Project: ${project.name} (${task.project_id})`)
          console.log(`  - week_number: ${task.week_number}`)
        }
      }

      // サマリー
      console.log('\n📊 Summary:')
      console.log(`  - Total Projects: ${projects.length}`)
      console.log(`  - Total BigTasks: ${bigTasks.length}`)
      console.log(`  - Valid BigTasks: ${validTasks.length}`)
      console.log(`  - Orphaned BigTasks: ${orphanedTasks.length}`)

      if (orphanedTasks.length > 0) {
        console.log('\n⚠️  Action Required: Found orphaned BigTasks!')
        console.log('These tasks reference non-existent projects.')
      }

      return {
        projects,
        bigTasks,
        orphanedTasks,
        validTasks,
      }
    } catch (error) {
      console.error('Error checking relations:', error)
    }
  },

  /**
   * データの詳細情報を表示
   */
  async showDetailedDataInfo() {
    console.log('=== Detailed Data Information ===')

    try {
      const projects = await db.projects.toArray()
      const bigTasks = await db.big_tasks.toArray()
      const smallTasks = await db.small_tasks.toArray()

      console.log('\n📁 Database Contents:')
      console.log(`  - Projects: ${projects.length}`)
      console.log(`  - BigTasks: ${bigTasks.length}`)
      console.log(`  - SmallTasks: ${smallTasks.length}`)

      // プロジェクトごとのタスク数を集計
      console.log('\n📊 Tasks per Project:')
      for (const project of projects) {
        const projectBigTasks = bigTasks.filter(bt => bt.project_id === project.id)
        const projectSmallTasks = smallTasks.filter(st => st.project_id === project.id)

        console.log(`\n  ${project.name} (ID: ${project.id}):`)
        console.log(`    - BigTasks: ${projectBigTasks.length}`)
        console.log(`    - SmallTasks: ${projectSmallTasks.length}`)
        console.log(`    - Created: ${new Date(project.created_at).toLocaleString('ja-JP')}`)

        if (projectBigTasks.length > 0) {
          console.log(`    - Week numbers: ${projectBigTasks.map(t => t.week_number).join(', ')}`)
        }
      }

      // 孤立したタスクの詳細
      const orphanedBigTasks = bigTasks.filter(bt => !projects.some(p => p.id === bt.project_id))

      if (orphanedBigTasks.length > 0) {
        console.log('\n⚠️  Orphaned BigTasks Details:')
        orphanedBigTasks.forEach((task: any) => {
          console.log(`\n  - ${task.name}`)
          console.log(`    ID: ${task.id}`)
          console.log(`    project_id: ${task.project_id} (NOT FOUND)`)
          console.log(`    Created: ${new Date(task.created_at).toLocaleString('ja-JP')}`)
        })
      }
    } catch (error) {
      console.error('Error showing data info:', error)
    }
  },

  /**
   * 孤立したBigTaskを修復（手動でproject_idを設定）
   */
  async repairOrphanedBigTasks(targetProjectId: string) {
    console.log(`=== Repairing Orphaned BigTasks ===`)
    console.log(`Target Project ID: ${targetProjectId}`)

    try {
      // ターゲットプロジェクトの存在確認
      const targetProject = await db.projects.get(targetProjectId)
      if (!targetProject) {
        console.error('❌ Target project not found!')
        return
      }

      console.log(`✅ Target Project: ${targetProject.name}`)

      // 全プロジェクトIDのセットを作成
      const projects = await db.projects.toArray()
      const projectIds = new Set(projects.map(p => p.id))

      // 孤立したBigTaskを検索
      const bigTasks = await db.big_tasks.toArray()
      const orphanedTasks = bigTasks.filter(bt => !projectIds.has(bt.project_id))

      if (orphanedTasks.length === 0) {
        console.log('✅ No orphaned BigTasks found!')
        return
      }

      console.log(`\n Found ${orphanedTasks.length} orphaned BigTasks`)
      console.log('Repairing...')

      // 各タスクを修復
      for (const task of orphanedTasks) {
        console.log(`\n  Updating: ${task.name}`)
        console.log(`    Old project_id: ${task.project_id}`)
        console.log(`    New project_id: ${targetProjectId}`)

        await db.big_tasks.update(task.id, {
          project_id: targetProjectId,
          updated_at: new Date().toISOString(),
        })
      }

      console.log(`\n✅ Successfully repaired ${orphanedTasks.length} BigTasks`)
    } catch (error) {
      console.error('Error repairing tasks:', error)
    }
  },

  /**
   * プロジェクト作成プロセスの問題を診断
   */
  async diagnoseProjectCreation() {
    console.log('=== Project Creation Diagnosis ===')

    try {
      const projects = await db.projects.toArray()
      const bigTasks = await db.big_tasks.toArray()

      // 最新のプロジェクトを確認
      const latestProject = projects.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      if (latestProject) {
        console.log('\n📋 Latest Project:')
        console.log(`  - Name: ${latestProject.name}`)
        console.log(`  - ID: ${latestProject.id}`)
        console.log(`  - Created: ${new Date(latestProject.created_at).toLocaleString('ja-JP')}`)

        // このプロジェクトのBigTaskを確認
        const projectBigTasks = bigTasks.filter(bt => bt.project_id === latestProject.id)
        console.log(`\n  Related BigTasks: ${projectBigTasks.length}`)
        projectBigTasks.forEach((task: any) => {
          console.log(`    - ${task.name} (Week ${task.week_number})`)
        })
      }

      // 全BigTaskのproject_idフィールドをチェック
      console.log('\n📝 BigTask project_id Field Check:')
      const tasksByProjectId = new Map<string, number>()

      bigTasks.forEach((task: any) => {
        const count = tasksByProjectId.get(task.project_id) || 0
        tasksByProjectId.set(task.project_id, count + 1)
      })

      console.log('\n  Project ID Distribution:')
      Array.from(tasksByProjectId.entries()).forEach(([projectId, count]) => {
        const project = projects.find(p => p.id === projectId)
        const status = project ? '✅' : '❌'
        const projectName = project ? project.name : 'NOT FOUND'
        console.log(`    ${status} ${projectId}: ${count} tasks (${projectName})`)
      })
    } catch (error) {
      console.error('Error diagnosing:', error)
    }
  },
}

// グローバルに公開（ブラウザコンソールから使用可能）
if (typeof window !== 'undefined') {
  ;(window as any).debugUtils = debugUtils
  console.log('✅ Debug utilities loaded! Available commands:')
  console.log('  - debugUtils.checkBigTaskProjectRelations()')
  console.log('  - debugUtils.showDetailedDataInfo()')
  console.log('  - debugUtils.repairOrphanedBigTasks(projectId)')
  console.log('  - debugUtils.diagnoseProjectCreation()')
}
