/**
 * 直接実行可能なデバッグスクリプト
 * コンソールにコピー＆ペーストして使用
 */

// データベーススキーマを確認
export async function checkDatabaseSchema() {
  console.log('=== データベーススキーマ確認 ===')
  try {
    // @ts-expect-error - Accessing window.db for debugging purposes
    const db = window.db || (await import('@/lib/db/database')).db
    console.log('データベース接続: OK')
    console.log('DBバージョン:', db.verno)

    // テーブル一覧
    console.log('\nテーブル一覧:')
    db.tables.forEach((table: any) => {
      console.log(`- ${table.name}`)
    })

    // big_tasksテーブルの確認
    const bigTasksTable = db.big_tasks
    console.log('\nbig_tasksテーブル:')
    console.log('  存在確認:', bigTasksTable ? 'OK' : 'NG')
    if (bigTasksTable && bigTasksTable.schema) {
      console.log('  スキーマ:', bigTasksTable.schema)
    }

    // サンプルデータ取得
    const sampleBigTasks = await bigTasksTable.limit(3).toArray()
    console.log('\nサンプルBigTask数:', sampleBigTasks.length)
    if (sampleBigTasks.length > 0) {
      console.log('サンプル:', sampleBigTasks[0])
    }
  } catch (error) {
    console.error('エラー:', error)
  }
}

// プロジェクト作成のテスト
export async function testProjectCreation() {
  console.log('=== プロジェクト作成テスト ===')

  try {
    // @ts-expect-error - Accessing window.db for debugging purposes
    const db = window.db || (await import('@/lib/db/database')).db

    // テストデータ
    const testProject = {
      id: crypto.randomUUID(),
      name: 'テストプロジェクト_' + Date.now(),
      goal: 'テスト目標',
      deadline: '2025-08-31',
      status: 'planning' as const,
      user_id: 'current-user',
      version: 1,
      estimated_total_hours: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log('作成するプロジェクト:', testProject)

    // プロジェクト作成
    await db.projects.add(testProject)
    console.log('✅ プロジェクト作成成功')

    // 作成したプロジェクトを確認
    const created = await db.projects.get(testProject.id)
    console.log('作成されたプロジェクト:', created)

    // クリーンアップ
    await db.projects.delete(testProject.id)
    console.log('テストプロジェクトを削除しました')

    return true
  } catch (error) {
    console.error('❌ エラー発生:', error)
    return false
  }
}

// BigTask作成のテスト
export async function testBigTaskCreation() {
  console.log('=== BigTask作成テスト ===')

  try {
    // @ts-expect-error - Accessing window.db for debugging purposes
    const db = window.db || (await import('@/lib/db/database')).db

    // テストBigTask
    const testBigTask = {
      id: crypto.randomUUID(),
      project_id: 'test-project-id',
      user_id: 'current-user',
      name: 'テストBigTask',
      category: 'テスト',
      week_number: 1,
      week_start_date: new Date('2025-08-04').toISOString(),
      week_end_date: new Date('2025-08-10').toISOString(),
      estimated_hours: 10,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log('作成するBigTask:', testBigTask)

    // BigTask作成
    await db.big_tasks.add(testBigTask)
    console.log('✅ BigTask作成成功')

    // 作成したBigTaskを確認
    const created = await db.big_tasks.get(testBigTask.id)
    console.log('作成されたBigTask:', created)

    // クリーンアップ
    await db.big_tasks.delete(testBigTask.id)
    console.log('テストBigTaskを削除しました')

    return true
  } catch (error) {
    console.error('❌ エラー発生:', error)
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message)
      console.error('スタック:', error.stack)
    }
    return false
  }
}

// 実際のプロジェクトデータを確認
export async function checkActualData() {
  console.log('=== 実際のデータ確認 ===')

  try {
    // @ts-expect-error - Accessing window.db for debugging purposes
    const db = window.db || (await import('@/lib/db/database')).db

    // プロジェクト一覧
    const projects = await db.projects.toArray()
    console.log(`\nプロジェクト数: ${projects.length}`)
    projects.forEach((p: any) => {
      console.log(`- ${p.name} (ID: ${p.id})`)
    })

    // BigTask一覧
    const bigTasks = await db.big_tasks.toArray()
    console.log(`\nBigTask数: ${bigTasks.length}`)

    // 最新のBigTaskを確認
    if (bigTasks.length > 0) {
      const latest = bigTasks.sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      console.log('\n最新のBigTask:')
      console.log(latest)

      // 日付範囲の有無を確認
      const withDateRange = bigTasks.filter((t: any) => t.week_start_date && t.week_end_date)
      console.log(`\n日付範囲あり: ${withDateRange.length}`)
      console.log(`日付範囲なし: ${bigTasks.length - withDateRange.length}`)
    }
  } catch (error) {
    console.error('エラー:', error)
  }
}

// コンソールで直接実行可能にする
if (typeof window !== 'undefined') {
  // @ts-expect-error - Adding debug utilities to window object
  window.directDebug = {
    checkDatabaseSchema,
    testProjectCreation,
    testBigTaskCreation,
    checkActualData,
  }

  console.log('🔧 Direct debug functions loaded!')
  console.log('Usage:')
  console.log('  directDebug.checkDatabaseSchema()')
  console.log('  directDebug.testProjectCreation()')
  console.log('  directDebug.testBigTaskCreation()')
  console.log('  directDebug.checkActualData()')
}
