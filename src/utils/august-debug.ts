/**
 * 8月プロジェクトのデバッグユーティリティ
 */

import { db } from '@/lib/db/database'
import { format, startOfWeek } from 'date-fns'
import { ja } from 'date-fns/locale'

export const augustDebug = {
  /**
   * 8月のプロジェクトとタスクの状況を確認
   */
  async checkAugustProject() {
    console.log('=== 8月プロジェクトのデバッグ ===')

    try {
      const projects = await db.projects.toArray()
      const bigTasks = await db.bigTasks.toArray()

      // 8月のプロジェクトを探す
      const augustProjects = projects.filter(p => {
        const createdDate = new Date(p.created_at)
        return createdDate.getMonth() === 7 && createdDate.getFullYear() === 2025 // 8月は7
      })

      if (augustProjects.length === 0) {
        console.log('❌ 8月のプロジェクトが見つかりません')

        // 全プロジェクトの作成日を表示
        console.log('\n📋 全プロジェクト一覧:')
        projects.forEach(p => {
          console.log(
            `  - ${p.name}: ${format(new Date(p.created_at), 'yyyy-MM-dd', { locale: ja })}`
          )
        })
        return
      }

      augustProjects.forEach(project => {
        console.log(`\n📅 プロジェクト: ${project.name}`)
        console.log(
          `  作成日: ${format(new Date(project.created_at), 'yyyy-MM-dd (E)', { locale: ja })}`
        )
        console.log(`  ID: ${project.id}`)

        // このプロジェクトのタスク
        const projectTasks = bigTasks.filter(t => t.project_id === project.id)
        console.log(`\n  📝 タスク一覧 (${projectTasks.length}件):`)
        projectTasks.forEach(task => {
          console.log(`    - ${task.name} (week_number: ${task.week_number})`)
        })

        // 週番号の対応表を作成
        console.log('\n  📊 週番号マッピング:')
        const projectStart = new Date(project.created_at)
        const projectWeekStart = startOfWeek(projectStart, { weekStartsOn: 1 })

        for (let i = 0; i < 6; i++) {
          const weekStart = new Date(projectWeekStart)
          weekStart.setDate(weekStart.getDate() + i * 7)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 6)

          console.log(
            `    第${i + 1}週: ${format(weekStart, 'MM/dd')} - ${format(weekEnd, 'MM/dd')}`
          )

          // この週のタスク
          const weekTasks = projectTasks.filter(t => t.week_number === i + 1)
          if (weekTasks.length > 0) {
            weekTasks.forEach(t => {
              console.log(`      → ${t.name}`)
            })
          }
        }

        // 現在の週（8/4-8/10）の計算
        console.log('\n  🔍 8月4日〜10日の週の計算:')
        const aug4 = new Date('2025-08-04')
        const aug4WeekStart = startOfWeek(aug4, { weekStartsOn: 1 })

        const diffInMs = aug4WeekStart.getTime() - projectWeekStart.getTime()
        const diffInWeeks = Math.floor(diffInMs / (7 * 24 * 60 * 60 * 1000))
        const calculatedWeekNumber = diffInWeeks + 1

        console.log(`    プロジェクト開始週: ${format(projectWeekStart, 'yyyy-MM-dd')}`)
        console.log(`    8月4日の週: ${format(aug4WeekStart, 'yyyy-MM-dd')}`)
        console.log(`    週の差: ${diffInWeeks}`)
        console.log(`    計算された週番号: ${calculatedWeekNumber}`)

        // この週番号のタスクを表示
        const aug4WeekTasks = projectTasks.filter(t => t.week_number === calculatedWeekNumber)
        console.log(`\n    この週のタスク (week_number = ${calculatedWeekNumber}):`)
        if (aug4WeekTasks.length > 0) {
          aug4WeekTasks.forEach(t => {
            console.log(`      ✅ ${t.name}`)
          })
        } else {
          console.log(`      ❌ タスクが見つかりません`)
          console.log(`      → 実際のタスクは week_number = 2 に保存されている可能性があります`)
        }
      })
    } catch (error) {
      console.error('Error in august debug:', error)
    }
  },

  /**
   * 週番号のミスマッチを修正する提案
   */
  showFixSuggestion() {
    console.log('\n=== 修正案 ===')
    console.log('問題: プロジェクト作成時の週番号（1,2,3...）と表示時の計算が異なる')
    console.log('\n解決方法:')
    console.log('1. プロジェクトに正式な開始日フィールドを追加')
    console.log('2. 週番号計算を統一（常にプロジェクト開始週からの相対週数）')
    console.log('3. または、タスクに絶対的な週開始日を保存')

    console.log('\n一時的な対処法:')
    console.log('calculateWeekNumber関数を以下のように修正:')
    console.log(`
const calculateWeekNumber = (projectId: string, targetDate: Date): number => {
  const project = projects.find(p => p.id === projectId)
  if (!project) return 1
  
  // 8月のプロジェクトの特別処理
  const projectDate = new Date(project.created_at)
  if (projectDate.getMonth() === 7 && projectDate.getFullYear() === 2025) {
    const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 })
    const dateStr = format(targetWeekStart, 'yyyy-MM-dd')
    
    // 手動マッピング
    const weekMap: Record<string, number> = {
      '2025-07-28': 1,  // 7/28-8/3
      '2025-08-04': 2,  // 8/4-8/10
      '2025-08-11': 3,  // 8/11-8/17
      '2025-08-18': 4,  // 8/18-8/24
      '2025-08-25': 5,  // 8/25-8/31
    }
    
    return weekMap[dateStr] || 1
  }
  
  // その他のプロジェクトは既存のロジック
  // ...
}`)
  },
}

// グローバルに公開
if (typeof window !== 'undefined') {
  ;(window as any).augustDebug = augustDebug
  console.log('📅 August debug utilities loaded!')
  console.log('  - augustDebug.checkAugustProject()')
  console.log('  - augustDebug.showFixSuggestion()')
}
