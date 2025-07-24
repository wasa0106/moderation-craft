/**
 * BigTasksとSmallTasksのテストデータを作成するページ
 */
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { bigTaskRepository, smallTaskRepository, projectRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Project } from '@/types'

export default function CreateTestTasksPage() {
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [createdBigTaskId, setCreatedBigTaskId] = useState<string>('')

  // プロジェクト一覧を取得
  useEffect(() => {
    const loadProjects = async () => {
      const projectList = await projectRepository.getByUserId('current-user')
      setProjects(projectList)
      if (projectList.length > 0) {
        setSelectedProjectId(projectList[0].id)
      }
    }
    loadProjects()
  }, [])

  const createTestBigTasks = async () => {
    if (!selectedProjectId) {
      toast.error('プロジェクトを選択してください')
      return
    }
    
    setLoading(true)
    try {
      const projectId = selectedProjectId
      
      // BigTasksを作成
      const bigTask1 = await bigTaskRepository.create({
        project_id: projectId,
        user_id: 'current-user',
        name: 'バックエンドAPI開発',
        category: '開発',
        week_number: 1,
        week_start_date: new Date('2025-01-20').toISOString(),
        week_end_date: new Date('2025-01-26').toISOString(),
        estimated_hours: 40,
        status: 'pending',
      })
      
      const bigTask2 = await bigTaskRepository.create({
        project_id: projectId,
        user_id: 'current-user',
        name: 'フロントエンド実装',
        category: '開発',
        week_number: 2,
        week_start_date: new Date('2025-01-27').toISOString(),
        week_end_date: new Date('2025-02-02').toISOString(),
        estimated_hours: 35,
        status: 'pending',
      })
      
      const bigTask3 = await bigTaskRepository.create({
        project_id: projectId,
        user_id: 'current-user',
        name: 'テストとデプロイ',
        category: 'テスト',
        week_number: 3,
        week_start_date: new Date('2025-02-03').toISOString(),
        week_end_date: new Date('2025-02-09').toISOString(),
        estimated_hours: 25,
        status: 'pending',
      })
      
      setCreatedBigTaskId(bigTask1.id)
      toast.success('BigTasksを作成しました')
      console.log('作成されたBigTasks:', [bigTask1, bigTask2, bigTask3])
    } catch (error) {
      console.error('BigTasks作成エラー:', error)
      toast.error('BigTasksの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const createTestSmallTasks = async () => {
    if (!createdBigTaskId) {
      toast.error('先にBigTasksを作成してください')
      return
    }
    
    setLoading(true)
    try {
      // SmallTasksを作成
      const smallTask1 = await smallTaskRepository.create({
        big_task_id: createdBigTaskId,
        user_id: 'current-user',
        name: 'データベース設計',
        estimated_minutes: 120,
        is_must: true,
        status: 'pending',
      })
      
      const smallTask2 = await smallTaskRepository.create({
        big_task_id: createdBigTaskId,
        user_id: 'current-user',
        name: 'API エンドポイント実装',
        estimated_minutes: 180,
        is_must: true,
        status: 'pending',
      })
      
      const smallTask3 = await smallTaskRepository.create({
        big_task_id: createdBigTaskId,
        user_id: 'current-user',
        name: '認証機能の実装',
        estimated_minutes: 90,
        is_must: false,
        status: 'pending',
      })
      
      toast.success('SmallTasksを作成しました')
      console.log('作成されたSmallTasks:', [smallTask1, smallTask2, smallTask3])
    } catch (error) {
      console.error('SmallTasks作成エラー:', error)
      toast.error('SmallTasksの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">テストタスク作成</h1>
      
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">プロジェクト選択</h2>
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder="プロジェクトを選択" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">BigTasks</h2>
          <p className="text-sm text-muted-foreground mb-4">
            プロジェクトに紐づくBigTasksを作成します
          </p>
          <Button
            onClick={createTestBigTasks}
            disabled={loading || !selectedProjectId}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            BigTasksを作成
          </Button>
        </div>
        
        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">SmallTasks</h2>
          <p className="text-sm text-muted-foreground mb-4">
            BigTaskに紐づくSmallTasksを作成します
          </p>
          <Button
            onClick={createTestSmallTasks}
            disabled={loading || !createdBigTaskId}
            variant={createdBigTaskId ? 'default' : 'secondary'}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            SmallTasksを作成
          </Button>
          {!createdBigTaskId && (
            <p className="text-xs text-muted-foreground mt-2">
              先にBigTasksを作成してください
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}