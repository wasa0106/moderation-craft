// シンプルなデバッグスクリプト（ブラウザコンソール用）
// このファイル全体をコンソールにコピー＆ペースト

window.simpleDebug = {
  // データベース接続確認
  async checkDB() {
    const db = window.db
    if (!db) {
      console.error('❌ データベースが初期化されていません')
      return false
    }
    console.log('✅ データベース接続: OK')
    console.log('バージョン:', db.verno)

    // テーブル確認
    console.log('\nテーブル確認:')
    console.log('  projects:', db.projects ? '✅' : '❌')
    console.log('  big_tasks:', db.big_tasks ? '✅' : '❌')
    console.log('  small_tasks:', db.small_tasks ? '✅' : '❌')

    return true
  },

  // プロジェクト作成テスト
  async testProject() {
    console.log('\n=== プロジェクト作成テスト ===')
    const db = window.db
    if (!db) {
      console.error('DBが初期化されていません')
      return
    }

    const testId = 'test-' + Date.now()
    const testProject = {
      id: testId,
      name: 'テストプロジェクト',
      goal: 'テスト',
      deadline: '2025-12-31',
      status: 'planning',
      user_id: 'current-user',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      await db.projects.add(testProject)
      console.log('✅ 作成成功')

      const result = await db.projects.get(testId)
      console.log('確認:', result)

      await db.projects.delete(testId)
      console.log('✅ クリーンアップ完了')

      return true
    } catch (e) {
      console.error('❌ エラー:', e)
      return false
    }
  },

  // BigTask作成テスト
  async testBigTask() {
    console.log('\n=== BigTask作成テスト ===')
    const db = window.db
    if (!db) {
      console.error('DBが初期化されていません')
      return
    }

    const testId = 'test-' + Date.now()
    const testTask = {
      id: testId,
      project_id: 'test-project',
      user_id: 'current-user',
      name: 'テストタスク',
      category: 'テスト',
      week_number: 1,
      week_start_date: '2025-08-04',
      week_end_date: '2025-08-10',
      estimated_hours: 10,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      await db.big_tasks.add(testTask)
      console.log('✅ 作成成功')

      const result = await db.big_tasks.get(testId)
      console.log('確認:', result)

      await db.big_tasks.delete(testId)
      console.log('✅ クリーンアップ完了')

      return true
    } catch (e) {
      console.error('❌ エラー:', e)
      return false
    }
  },

  // 実データ確認
  async checkData() {
    console.log('\n=== 実データ確認 ===')
    const db = window.db
    if (!db) return

    try {
      const projects = await db.projects.toArray()
      console.log(`プロジェクト数: ${projects.length}`)

      const bigTasks = await db.big_tasks.toArray()
      console.log(`BigTask数: ${bigTasks.length}`)

      if (projects.length > 0) {
        console.log('\n最新プロジェクト:')
        console.log(projects[projects.length - 1])
      }

      if (bigTasks.length > 0) {
        console.log('\n最新BigTask:')
        console.log(bigTasks[bigTasks.length - 1])
      }
    } catch (e) {
      console.error('エラー:', e)
    }
  },
}

console.log('✅ simpleDebug loaded!')
console.log('使い方:')
console.log('  simpleDebug.checkDB() - DB接続確認')
console.log('  simpleDebug.testProject() - プロジェクト作成テスト')
console.log('  simpleDebug.testBigTask() - BigTask作成テスト')
console.log('  simpleDebug.checkData() - 実データ確認')
