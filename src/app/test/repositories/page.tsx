'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { projectRepository, bigTaskRepository, smallTaskRepository } from '@/lib/db/repositories'

export default function RepositoriesTestPage() {
  const [results, setResults] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const testRepositories = async () => {
    setLoading(true)
    try {
      console.log('Repository テスト開始...')

      // 1. プロジェクト作成テスト
      const newProject = {
        user_id: 'test-user-123',
        name: 'テストプロジェクト',
        goal: 'Repository動作確認',
        deadline: '2025-08-15',
        status: 'active' as const,
        version: 1,
      }

      const createdProject = await projectRepository.create(newProject)
      console.log('プロジェクト作成成功:', createdProject)

      // 2. プロジェクト取得テスト
      const project = await projectRepository.getById(createdProject.id)
      console.log('プロジェクト取得成功:', project)

      // 3. アクティブプロジェクト取得テスト
      const activeProjects = await projectRepository.getActiveProjects('test-user-123')
      console.log('アクティブプロジェクト取得成功:', activeProjects)

      // 4. 今日のタスク取得テスト
      const todayTasks = await smallTaskRepository.getScheduledForDate(
        'test-user-123',
        '2025-07-09'
      )
      console.log('今日のタスク取得成功:', todayTasks)

      // 5. BigTaskRepositoryの委譲メソッドテスト
      const bigTaskTodayTasks = await bigTaskRepository.getScheduledForDate(
        'test-user-123',
        '2025-07-09'
      )
      console.log('BigTaskRepository委譲メソッドテスト成功:', bigTaskTodayTasks)

      const testResults = {
        projectId: createdProject.id,
        project: project?.name,
        activeProjects: activeProjects.length,
        todayTasks: todayTasks.length,
        bigTaskTodayTasks: bigTaskTodayTasks.length,
        status: 'success',
        timestamp: new Date().toISOString(),
      }

      setResults(testResults)
      console.log('Repository テスト完了:', testResults)
    } catch (error) {
      console.error('Repository test error:', error)
      setResults({
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">Repository 動作確認</h1>

        <Card>
          <CardHeader>
            <CardTitle>データベース Repository テスト</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              プロジェクト作成・取得・一覧表示の基本機能をテストします。
            </p>

            <Button onClick={testRepositories} disabled={loading} className="w-full">
              {loading ? 'テスト実行中...' : 'Repository テスト実行'}
            </Button>

            {results && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">テスト結果:</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Repository機能一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">ProjectRepository</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• create() - プロジェクト作成</li>
                  <li>• getById() - ID取得</li>
                  <li>• getActiveProjects() - アクティブ取得</li>
                  <li>• getByUserId() - ユーザー別取得</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">SmallTaskRepository</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• getScheduledForDate() - 日付別取得</li>
                  <li>• getByBigTaskId() - 大タスク別取得</li>
                  <li>• getEmergencyTasks() - 緊急タスク取得</li>
                  <li>• startTask() - タスク開始</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">BigTaskRepository</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• getByProjectId() - プロジェクト別取得</li>
                  <li>• getByWeekNumber() - 週番号別取得</li>
                  <li>• getScheduledForDate() - 委譲メソッド</li>
                  <li>• updateActualHours() - 実績更新</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">SessionRepository</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• startSession() - セッション開始</li>
                  <li>• endSession() - セッション終了</li>
                  <li>• getActiveSession() - アクティブセッション</li>
                  <li>• getUnsyncedSessions() - 未同期取得</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
