'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  projectRepository,
  bigTaskRepository,
  smallTaskRepository,
  moodEntryRepository,
  dopamineEntryRepository,
  syncQueueRepository
} from '@/lib/db/repositories'
import { useSyncStore } from '@/stores/sync-store'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import { toast } from 'sonner'
import { syncLogger } from '@/lib/utils/logger'

export default function UpdateDeleteTestPage() {
  // テスト用のuserIdを使用
  const userId = 'current-user'
  
  const { projects, refetch: refetchProjects } = useProjects(userId)
  const { bigTasks, refetch: refetchBigTasks } = useBigTasks(userId)
  // smallTasksは全てのタスクを取得するためにカスタムクエリを使用
  const [smallTasks, setSmallTasks] = useState<any[]>([])
  
  const refetchSmallTasks = async () => {
    try {
      // user_idでフィルタリングするカスタムメソッドを使用
      const allTasks = await smallTaskRepository.list()
      const userTasks = allTasks.filter(task => task.user_id === userId)
      setSmallTasks(userTasks)
      console.log('Fetched SmallTasks:', userTasks)
    } catch (error) {
      console.error('Error fetching small tasks:', error)
    }
  }
  
  useEffect(() => {
    refetchSmallTasks()
  }, [])
  
  // デバッグ用：全データを取得
  const [allBigTasks, setAllBigTasks] = useState<any[]>([])
  const [allSmallTasks, setAllSmallTasks] = useState<any[]>([])
  
  useEffect(() => {
    const debugFetch = async () => {
      try {
        // 全BigTaskを取得
        const allBig = await bigTaskRepository.list()
        console.log('All BigTasks in IndexedDB:', allBig)
        setAllBigTasks(allBig)
        
        // 全SmallTaskを取得
        const allSmall = await smallTaskRepository.list()
        console.log('All SmallTasks in IndexedDB:', allSmall)
        setAllSmallTasks(allSmall)
        
        // user_idでフィルタリングされたデータ
        const userBigTasks = await bigTaskRepository.getTasksByUser(userId)
        console.log(`BigTasks for user ${userId}:`, userBigTasks)
        
        const userSmallTasks = await smallTaskRepository.getActiveTasks(userId)
        console.log(`SmallTasks for user ${userId}:`, userSmallTasks)
        
        // useSmallTasksフックのデータと比較
        console.log('Hook smallTasks:', smallTasks)
        console.log('Hook bigTasks:', bigTasks)
      } catch (error) {
        console.error('Debug fetch error:', error)
      }
    }
    
    debugFetch()
  }, [])
  
  const syncQueue = useSyncStore(state => state.syncQueue)
  const pendingCount = syncQueue.filter(item => item.status === 'pending').length
  
  // 同期キューの変更を監視
  useEffect(() => {
    console.log('Sync queue updated:', syncQueue)
    console.log('Pending count:', pendingCount)
  }, [syncQueue, pendingCount])
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedBigTaskId, setSelectedBigTaskId] = useState<string | null>(null)
  const [selectedSmallTaskId, setSelectedSmallTaskId] = useState<string | null>(null)
  
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [bigTaskTitle, setBigTaskTitle] = useState('')
  const [smallTaskTitle, setSmallTaskTitle] = useState('')
  
  // テストデータ作成関数
  const createTestData = async () => {
    try {
      console.log('createTestData開始 - 現在のプロジェクト数:', projects.length)
      
      // プロジェクトがない場合は作成
      if (projects.length === 0) {
        const testProject = await projectRepository.create({
          user_id: userId,
          name: 'UPDATE/DELETEテスト用プロジェクト',
          description: '同期機能のテスト用',
          goal: 'テスト完了',
          deadline: '2025-12-31',
          status: 'active',
          version: 1
        })
        toast.success('テストプロジェクトを作成しました')
        await refetchProjects() // プロジェクトを再取得して待つ
      }
      
      // プロジェクトを取得
      const projectList = await projectRepository.getByUserId(userId)
      const project = projectList[0]
      
      if (!project) {
        toast.error('プロジェクトが見つかりません')
        return
      }
      
      console.log('Using project:', project)
      
      // BigTaskがない場合は作成
      if (bigTasks.length === 0) {
        try {
          const testBigTask = await bigTaskRepository.create({
            user_id: userId,
            project_id: project.id,
            title: 'UPDATE/DELETEテスト用BigTask',
            estimated_hours: 10,
            week_number: 1,
            status: 'pending',
            version: 1
          })
          console.log('Created BigTask:', testBigTask)
          toast.success('テストBigTaskを作成しました')
          await refetchBigTasks() // BigTaskを再取得して待つ
        } catch (bigTaskError) {
          console.error('BigTask作成エラー:', bigTaskError)
          toast.error(`BigTask作成失敗: ${bigTaskError instanceof Error ? bigTaskError.message : 'Unknown error'}`)
          return
        }
      }
      
      // BigTaskを取得
      const bigTaskList = await bigTaskRepository.getTasksByUser(userId)
      const bigTask = bigTaskList[0]
      
      if (!bigTask) {
        toast.error('BigTaskが見つかりません')
        return
      }
      
      console.log('Using BigTask:', bigTask)
      
      // SmallTaskがない場合は作成
      if (smallTasks.length === 0) {
        try {
          const testSmallTask = await smallTaskRepository.create({
            user_id: userId,
            project_id: project.id,
            big_task_id: bigTask.id,
            name: 'UPDATE/DELETEテスト用SmallTask',
            estimated_minutes: 60,
            scheduled_start: new Date().toISOString(),
            scheduled_end: new Date(Date.now() + 3600000).toISOString(),
            version: 1
          })
          console.log('Created SmallTask:', testSmallTask)
          toast.success('テストSmallTaskを作成しました')
          // 少し遅延させてから再取得（データベースの反映を待つ）
          setTimeout(() => {
            refetchSmallTasks()
          }, 100)
        } catch (smallTaskError) {
          console.error('SmallTask作成エラー:', smallTaskError)
          toast.error(`SmallTask作成失敗: ${smallTaskError instanceof Error ? smallTaskError.message : 'Unknown error'}`)
        }
      }
      
    } catch (error) {
      console.error('テストデータ作成エラー:', error)
      toast.error(`エラー: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // プロジェクトの更新
  const updateProject = async () => {
    if (!selectedProjectId) {
      toast.error('プロジェクトを選択してください')
      return
    }
    
    try {
      await projectRepository.update(selectedProjectId, {
        name: projectName || `更新されたプロジェクト ${new Date().toLocaleTimeString()}`,
        description: projectDescription || `更新時刻: ${new Date().toLocaleTimeString()}`
      })
      
      toast.success('プロジェクトを更新しました')
      refetchProjects()
      syncLogger.info('プロジェクトを更新:', selectedProjectId)
    } catch (error) {
      toast.error('プロジェクトの更新に失敗しました')
      console.error(error)
    }
  }
  
  // プロジェクトの削除
  const deleteProject = async () => {
    if (!selectedProjectId) {
      toast.error('プロジェクトを選択してください')
      return
    }
    
    try {
      await projectRepository.delete(selectedProjectId)
      toast.success('プロジェクトを削除しました')
      setSelectedProjectId(null)
      refetchProjects()
      syncLogger.info('プロジェクトを削除:', selectedProjectId)
    } catch (error) {
      toast.error('プロジェクトの削除に失敗しました')
      console.error(error)
    }
  }
  
  // BigTaskの更新
  const updateBigTask = async () => {
    if (!selectedBigTaskId) {
      toast.error('BigTaskを選択してください')
      return
    }
    
    try {
      console.log('Updating BigTask:', selectedBigTaskId, {
        title: bigTaskTitle || `更新されたBigTask ${new Date().toLocaleTimeString()}`
      })
      
      const result = await bigTaskRepository.update(selectedBigTaskId, {
        title: bigTaskTitle || `更新されたBigTask ${new Date().toLocaleTimeString()}`
        // updated_atは自動的に設定されるので不要
      })
      
      console.log('BigTask update result:', result)
      
      // 同期キューの状態を直接確認
      const syncQueueItems = await syncQueueRepository.list()
      console.log('Sync queue after update:', syncQueueItems)
      
      // Zustandストアの状態も確認
      const storeState = useSyncStore.getState()
      console.log('Sync store state:', storeState.syncQueue)
      
      toast.success('BigTaskを更新しました')
      refetchBigTasks()
      syncLogger.info('BigTaskを更新:', selectedBigTaskId)
    } catch (error) {
      toast.error('BigTaskの更新に失敗しました')
      console.error(error)
    }
  }
  
  // BigTaskの削除
  const deleteBigTask = async () => {
    if (!selectedBigTaskId) {
      toast.error('BigTaskを選択してください')
      return
    }
    
    try {
      await bigTaskRepository.delete(selectedBigTaskId)
      toast.success('BigTaskを削除しました')
      setSelectedBigTaskId(null)
      refetchBigTasks()
      syncLogger.info('BigTaskを削除:', selectedBigTaskId)
    } catch (error) {
      toast.error('BigTaskの削除に失敗しました')
      console.error(error)
    }
  }
  
  // SmallTaskの更新
  const updateSmallTask = async () => {
    if (!selectedSmallTaskId) {
      toast.error('SmallTaskを選択してください')
      return
    }
    
    try {
      console.log('Updating SmallTask:', selectedSmallTaskId, {
        name: smallTaskTitle || `更新されたSmallTask ${new Date().toLocaleTimeString()}`
      })
      
      const result = await smallTaskRepository.update(selectedSmallTaskId, {
        name: smallTaskTitle || `更新されたSmallTask ${new Date().toLocaleTimeString()}`
        // updated_atは自動的に設定されるので不要
      })
      
      console.log('SmallTask update result:', result)
      toast.success('SmallTaskを更新しました')
      refetchSmallTasks()
      syncLogger.info('SmallTaskを更新:', selectedSmallTaskId)
    } catch (error) {
      toast.error('SmallTaskの更新に失敗しました')
      console.error(error)
    }
  }
  
  // SmallTaskの削除
  const deleteSmallTask = async () => {
    if (!selectedSmallTaskId) {
      toast.error('SmallTaskを選択してください')
      return
    }
    
    try {
      await smallTaskRepository.delete(selectedSmallTaskId)
      toast.success('SmallTaskを削除しました')
      setSelectedSmallTaskId(null)
      refetchSmallTasks()
      syncLogger.info('SmallTaskを削除:', selectedSmallTaskId)
    } catch (error) {
      toast.error('SmallTaskの削除に失敗しました')
      console.error(error)
    }
  }
  
  // DynamoDBの同期状態を確認
  const checkDynamoDB = async () => {
    try {
      const response = await fetch('/api/sync/check', {
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY || 'development-key'
        }
      })
      const data = await response.json()
      console.log('DynamoDB同期状態:', data)
      toast.info(`DynamoDB内のアイテム数: ${data.count || 0}`)
    } catch (error) {
      console.error('DynamoDB確認エラー:', error)
      toast.error('DynamoDB確認に失敗しました')
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">UPDATE/DELETE 同期テスト</h1>
        <div className="flex items-center gap-4">
          <Button onClick={createTestData} variant="outline">
            テストデータ作成
          </Button>
          <Button onClick={checkDynamoDB} variant="outline">
            DynamoDB確認
          </Button>
          <Button 
            onClick={async () => {
              try {
                const { PullSyncService } = await import('@/lib/sync/pull-sync-service')
                const pullService = PullSyncService.getInstance()
                await pullService.pullFromCloud()
                toast.success('クラウドからデータを取得しました')
                refetchProjects()
                refetchBigTasks()
                refetchSmallTasks()
              } catch (error) {
                console.error('プル同期エラー:', error)
                toast.error('プル同期に失敗しました')
              }
            }} 
            variant="outline"
          >
            クラウドから取得
          </Button>
          <Badge variant={pendingCount > 0 ? "default" : "secondary"}>
            同期待ち: {pendingCount}
          </Badge>
        </div>
      </div>
      
      {/* プロジェクトのUPDATE/DELETE */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>プロジェクト</CardTitle>
          <Button 
            onClick={async () => {
              try {
                const newProject = await projectRepository.create({
                  user_id: userId,
                  name: `新規プロジェクト ${new Date().toLocaleTimeString()}`,
                  description: '手動作成',
                  goal: 'テスト',
                  deadline: '2025-12-31',
                  status: 'active',
                  version: 1
                })
                console.log('新規プロジェクト作成:', newProject)
                toast.success('プロジェクトを作成しました')
                refetchProjects()
              } catch (error) {
                console.error('プロジェクト作成エラー:', error)
                toast.error('プロジェクト作成に失敗しました')
              }
            }}
            size="sm"
            variant="outline"
          >
            新規作成
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 ? (
            <p className="text-muted-foreground">プロジェクトがありません</p>
          ) : (
            <>
              <div className="space-y-2">
                {projects.map(project => (
                  <div 
                    key={project.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedProjectId === project.id ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => {
                      setSelectedProjectId(project.id)
                      setProjectName(project.name)
                      setProjectDescription(project.description || '')
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">{project.description}</p>
                      </div>
                      <Badge variant="outline">{project.id.slice(0, 8)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedProjectId && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>プロジェクト名</Label>
                      <Input 
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="更新するプロジェクト名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>説明</Label>
                      <Textarea 
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        placeholder="更新する説明"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={updateProject} variant="default">
                        更新
                      </Button>
                      <Button onClick={deleteProject} variant="destructive">
                        削除
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* BigTaskのUPDATE/DELETE */}
      <Card>
        <CardHeader>
          <CardTitle>BigTask</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {bigTasks.length === 0 ? (
            <p className="text-muted-foreground">BigTaskがありません</p>
          ) : (
            <>
              <div className="space-y-2">
                {bigTasks.map(task => (
                  <div 
                    key={task.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedBigTaskId === task.id ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => {
                      setSelectedBigTaskId(task.id)
                      setBigTaskTitle(task.title)
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{task.title}</p>
                      <Badge variant="outline">{task.id.slice(0, 8)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedBigTaskId && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>タスク名</Label>
                      <Input 
                        value={bigTaskTitle}
                        onChange={(e) => setBigTaskTitle(e.target.value)}
                        placeholder="更新するタスク名"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={updateBigTask} variant="default">
                        更新
                      </Button>
                      <Button onClick={deleteBigTask} variant="destructive">
                        削除
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* SmallTaskのUPDATE/DELETE */}
      <Card>
        <CardHeader>
          <CardTitle>SmallTask</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {smallTasks.length === 0 ? (
            <p className="text-muted-foreground">SmallTaskがありません</p>
          ) : (
            <>
              <div className="space-y-2">
                {smallTasks.map(task => (
                  <div 
                    key={task.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSmallTaskId === task.id ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => {
                      setSelectedSmallTaskId(task.id)
                      setSmallTaskTitle(task.name)
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{task.name}</p>
                      <Badge variant="outline">{task.id.slice(0, 8)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedSmallTaskId && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>タスク名</Label>
                      <Input 
                        value={smallTaskTitle}
                        onChange={(e) => setSmallTaskTitle(e.target.value)}
                        placeholder="更新するタスク名"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={updateSmallTask} variant="default">
                        更新
                      </Button>
                      <Button onClick={deleteSmallTask} variant="destructive">
                        削除
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* デバッグ情報 */}
      <Card>
        <CardHeader>
          <CardTitle>デバッグ情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="font-semibold">IndexedDB内の全データ:</p>
            <p className="text-sm text-muted-foreground">
              BigTasks: {allBigTasks.length}件 
              {allBigTasks.length > 0 && ` (user_ids: ${[...new Set(allBigTasks.map(t => t.user_id))].join(', ')})`}
            </p>
            <p className="text-sm text-muted-foreground">
              SmallTasks: {allSmallTasks.length}件
              {allSmallTasks.length > 0 && ` (user_ids: ${[...new Set(allSmallTasks.map(t => t.user_id))].join(', ')})`}
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-semibold">現在のuserIdでフィルタリングされたデータ:</p>
            <p className="text-sm text-muted-foreground">userId: {userId}</p>
            <p className="text-sm text-muted-foreground">BigTasks: {bigTasks.length}件</p>
            <p className="text-sm text-muted-foreground">SmallTasks: {smallTasks.length}件</p>
          </div>
        </CardContent>
      </Card>
      
      {/* 同期キューの状態 */}
      <Card>
        <CardHeader>
          <CardTitle>同期キューの状態</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {syncQueue.length === 0 ? (
              <p className="text-muted-foreground">同期キューは空です</p>
            ) : (
              syncQueue.map(item => (
                <div key={item.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        item.status === 'pending' ? 'default' : 
                        item.status === 'processing' ? 'secondary' :
                        item.status === 'completed' ? 'outline' : 'destructive'
                      }>
                        {item.status}
                      </Badge>
                      <span className="font-medium">{item.operation_type}</span>
                      <span className="text-sm text-muted-foreground">{item.entity_type}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.entity_id.slice(0, 8)}...
                    </span>
                  </div>
                  {item.error_message && (
                    <p className="text-sm text-destructive">{item.error_message}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}