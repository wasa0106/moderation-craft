/**
 * テストデータ作成ページ
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  projectRepository,
  bigTaskRepository,
  smallTaskRepository
} from '@/lib/db/repositories'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function TestDataPage() {
  const [loading, setLoading] = useState(false)
  const [createdData, setCreatedData] = useState<any>({})
  const router = useRouter()

  const createTestData = async () => {
    try {
      setLoading(true)
      
      // 1. プロジェクトを作成
      const project = await projectRepository.create({
        user_id: 'current-user',
        name: 'テストプロジェクト - ポートフォリオサイト開発',
        goal: 'データエンジニアとしてのスキルを示すポートフォリオサイトを完成させる',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60日後
        status: 'active',
        version: 1,
        estimated_total_hours: 120
      })
      
      // 2. BigTasksを作成
      const bigTask1 = await bigTaskRepository.create({
        project_id: project.id,
        user_id: 'current-user',
        name: 'フロントエンド開発',
        category: '開発',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimated_hours: 40,
        status: 'active',
        priority: 'high',
        description: 'Next.jsを使用したフロントエンド開発'
      })

      const bigTask2 = await bigTaskRepository.create({
        project_id: project.id,
        user_id: 'current-user',
        name: 'データパイプライン構築',
        category: 'インフラ',
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimated_hours: 30,
        status: 'pending',
        priority: 'high',
        description: 'AWS DynamoDB, S3, dbtを使用したデータパイプライン'
      })

      // 3. SmallTasksを作成
      const today = new Date()
      const smallTask1 = await smallTaskRepository.create({
        big_task_id: bigTask1.id,
        user_id: 'current-user',
        project_id: project.id,
        name: 'タイマー機能の実装',
        estimated_minutes: 120,
        scheduled_start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
        scheduled_end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0).toISOString(),
        status: 'active',
        priority: 'high',
        description: 'WorkSessionの記録機能を実装',
        tags: ['React', 'Timer', 'IndexedDB']
      })

      const smallTask2 = await smallTaskRepository.create({
        big_task_id: bigTask1.id,
        user_id: 'current-user',
        project_id: project.id,
        name: '同期機能のテスト',
        estimated_minutes: 60,
        scheduled_start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
        scheduled_end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0).toISOString(),
        status: 'pending',
        priority: 'medium',
        description: 'DynamoDBへの同期機能をテスト',
        tags: ['AWS', 'DynamoDB', 'Testing']
      })

      const smallTask3 = await smallTaskRepository.create({
        big_task_id: bigTask2.id,
        user_id: 'current-user',
        project_id: project.id,
        name: 'DynamoDBスキーマ設計',
        estimated_minutes: 180,
        scheduled_start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 9, 0).toISOString(),
        scheduled_end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 12, 0).toISOString(),
        status: 'pending',
        priority: 'high',
        description: 'シングルテーブル設計でスキーマを設計',
        tags: ['DynamoDB', 'Architecture', 'NoSQL']
      })

      setCreatedData({
        project,
        bigTasks: [bigTask1, bigTask2],
        smallTasks: [smallTask1, smallTask2, smallTask3]
      })

      toast.success('テストデータを作成しました！')
    } catch (error) {
      console.error('テストデータ作成エラー:', error)
      toast.error('テストデータの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">テストデータ作成</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">一括作成</h2>
        <p className="text-sm text-muted-foreground mb-4">
          以下のテストデータを一括で作成します：
        </p>
        <ul className="list-disc list-inside text-sm mb-4 space-y-1">
          <li>プロジェクト: 1件（ポートフォリオサイト開発）</li>
          <li>大タスク: 2件（フロントエンド開発、データパイプライン構築）</li>
          <li>小タスク: 3件（各大タスクに紐づく具体的なタスク）</li>
        </ul>
        
        <Button
          onClick={createTestData}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              作成中...
            </>
          ) : (
            'テストデータを作成'
          )}
        </Button>
      </Card>

      {createdData.project && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">作成されたデータ</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">プロジェクト</h3>
              <p className="text-sm">{createdData.project.name}</p>
              <p className="text-xs text-muted-foreground">ID: {createdData.project.id}</p>
            </div>

            <div>
              <h3 className="font-medium mb-2">大タスク</h3>
              {createdData.bigTasks.map((task: any) => (
                <div key={task.id} className="text-sm mb-1">
                  <p>{task.name} ({task.category})</p>
                  <p className="text-xs text-muted-foreground">ID: {task.id}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-medium mb-2">小タスク</h3>
              {createdData.smallTasks.map((task: any) => (
                <div key={task.id} className="text-sm mb-1">
                  <p>{task.name} ({task.estimated_minutes}分)</p>
                  <p className="text-xs text-muted-foreground">ID: {task.id}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              onClick={() => router.push('/projects')}
              variant="outline"
            >
              プロジェクト一覧へ
            </Button>
            <Button
              onClick={() => router.push('/api/sync/all-entities-test')}
            >
              同期テストページへ
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}