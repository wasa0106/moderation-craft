/**
 * 全エンティティタイプの同期テストページ
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SyncService } from '@/lib/sync/sync-service'
import { 
  projectRepository,
  bigTaskRepository,
  smallTaskRepository,
  moodEntryRepository,
  dopamineEntryRepository
} from '@/lib/db/repositories'
import { MoodEntry, DopamineEntry } from '@/types'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-tasks'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'

export default function AllEntitiesTestPage() {
  const [loading, setLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedBigTaskId, setSelectedBigTaskId] = useState<string>('')
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([])
  const [dopamineEntries, setDopamineEntries] = useState<DopamineEntry[]>([])
  const syncService = SyncService.getInstance()
  
  // データ取得
  const { projects = [], refetch: refetchProjects, isLoading: projectsLoading, error: projectsError } = useProjects('current-user')
  const { bigTasks = [], refetch: refetchBigTasks, isLoading: bigTasksLoading, error: bigTasksError } = useBigTasks('current-user', selectedProjectId)
  const { smallTasks: allSmallTasks = [], refetch: refetchSmallTasks, isLoading: smallTasksLoading, error: smallTasksError } = useSmallTasks(selectedBigTaskId)
  
  // デバッグログ
  useEffect(() => {
    console.log('Projects:', projects, 'Loading:', projectsLoading, 'Error:', projectsError)
  }, [projects, projectsLoading, projectsError])
  
  useEffect(() => {
    console.log('BigTasks:', bigTasks, 'Loading:', bigTasksLoading, 'Error:', bigTasksError)
    console.log('Selected Project ID:', selectedProjectId)
    
    // 選択されたプロジェクトのBigTasksを直接確認
    if (selectedProjectId) {
      bigTaskRepository.getByProjectId(selectedProjectId).then(directBigTasks => {
        console.log('Direct BigTasks from IndexedDB:', directBigTasks)
      })
    }
  }, [bigTasks, bigTasksLoading, bigTasksError, selectedProjectId])
  
  useEffect(() => {
    console.log('SmallTasks:', allSmallTasks, 'Loading:', smallTasksLoading, 'Error:', smallTasksError)
  }, [allSmallTasks, smallTasksLoading, smallTasksError])
  
  // 初回レンダリング時にIndexedDBの内容を確認
  useEffect(() => {
    console.log('=== 初回レンダリング時のデバッグ ===')
    checkIndexedDB()
    loadMoodDopamineEntries()
    
    // React Query のキャッシュ状態を確認
    import('@/lib/query/query-client').then(({ queryClient }) => {
      const cache = queryClient.getQueryCache()
      const queries = cache.getAll()
      console.log('すべてのクエリ:', queries.map(q => ({ 
        queryKey: q.queryKey, 
        state: q.state,
        dataUpdateCount: q.state.dataUpdateCount,
        error: q.state.error 
      })))
    })
  }, [])
  
  // 選択されたBigTaskに属するSmallTaskをフィルタリング
  const smallTasks = allSmallTasks.filter(task => task.big_task_id === selectedBigTaskId)
  
  // プロジェクトが読み込まれたら、最初のアクティブなプロジェクトを選択
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const activeProject = projects.find(p => p.status === 'active') || projects[0]
      if (activeProject) {
        setSelectedProjectId(activeProject.id)
      }
    }
  }, [projects, selectedProjectId])
  
  // BigTaskが読み込まれたら、最初のタスクを選択
  useEffect(() => {
    if (bigTasks.length > 0 && !selectedBigTaskId) {
      setSelectedBigTaskId(bigTasks[0].id)
    } else if (bigTasks.length === 0) {
      setSelectedBigTaskId('')
    }
  }, [bigTasks, selectedBigTaskId])
  
  // データをリフレッシュ
  const refreshData = async () => {
    console.log('リフレッシュ開始...')
    setLoading(true)
    try {
      // キャッシュをクリアしてから再取得
      const { queryClient } = await import('@/lib/query/query-client')
      
      // 特定のクエリキーをインバリデート
      await queryClient.invalidateQueries({ queryKey: ['moderation-craft', 'projects', 'user', 'current-user'] })
      console.log('プロジェクトキャッシュをクリアしました')
      
      // すべてのクエリをインバリデート
      await queryClient.invalidateQueries()
      console.log('すべてのキャッシュをクリアしました')
      
      // 強制的に再フェッチ
      const results = await Promise.all([
        refetchProjects(),
        refetchBigTasks(),
        refetchSmallTasks()
      ])
      console.log('リフレッシュ結果:', results)
      
      // MoodEntry/DopamineEntryも再読み込み
      await loadMoodDopamineEntries()
      
      // 再フェッチ後のデータを確認
      const state = queryClient.getQueryState(['moderation-craft', 'projects', 'user', 'current-user'])
      console.log('Query state after refetch:', state)
      
      toast.success('データを更新しました')
    } catch (error) {
      console.error('リフレッシュエラー:', error)
      toast.error('データの更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // エンティティを同期キューに追加
  const addToQueue = async (entityType: string, entity: any) => {
    try {
      setLoading(true)
      
      console.log(`同期キューに追加: ${entityType}`, entity)
      
      await syncService.addToSyncQueue(
        entityType,
        entity.id,
        'create',
        entity
      )
      
      toast.success(`${entityType}を同期キューに追加しました`)
    } catch (error) {
      console.error('キュー追加エラー:', error)
      toast.error('同期キューへの追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 手動同期
  const manualSync = async () => {
    try {
      setLoading(true)
      toast.info('同期を開始します...')
      await syncService.forcSync()
      toast.success('同期が完了しました')
    } catch (error) {
      console.error('同期エラー:', error)
      toast.error('同期に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // テストデータを作成
  const createTestData = async (type: string) => {
    try {
      setLoading(true)
      
      switch (type) {
        case 'project':
          const project = await projectRepository.create({
            user_id: 'current-user',
            name: `テストプロジェクト ${Date.now()}`,
            goal: 'テスト目標',
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            version: 1
          })
          await refreshData()
          toast.success('テストプロジェクトを作成しました')
          break
          
        case 'mood_entry':
          const mood = await moodEntryRepository.create({
            user_id: 'current-user',
            timestamp: new Date().toISOString(),
            mood_level: 5,
            notes: 'テスト気分エントリー'
          })
          await addToQueue('mood_entry', mood)
          break
          
        case 'dopamine_entry':
          const dopamine = await dopamineEntryRepository.create({
            user_id: 'current-user',
            timestamp: new Date().toISOString(),
            event_description: 'テストドーパミンイベント',
            notes: 'テストノート'
          })
          await addToQueue('dopamine_entry', dopamine)
          break
      }
    } catch (error) {
      console.error('テストデータ作成エラー:', error)
      toast.error('テストデータの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // MoodEntry/DopamineEntryを読み込む
  const loadMoodDopamineEntries = async () => {
    try {
      // 過去7日間のエントリーを取得
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      
      const moods = await moodEntryRepository.getByDateRange(
        'current-user', 
        startDate.toISOString(), 
        endDate.toISOString()
      )
      const dopamines = await dopamineEntryRepository.getByDateRange(
        'current-user',
        startDate.toISOString(),
        endDate.toISOString()
      )
      
      console.log('Mood Entries:', moods)
      console.log('Dopamine Entries:', dopamines)
      
      setMoodEntries(moods)
      setDopamineEntries(dopamines)
    } catch (error) {
      console.error('MoodEntry/DopamineEntry読み込みエラー:', error)
    }
  }

  // IndexedDBから直接データを取得（デバッグ用）
  const checkIndexedDB = async () => {
    try {
      const directProjects = await projectRepository.getByUserId('current-user')
      console.log('IndexedDBから直接取得したプロジェクト:', directProjects)
      
      // React Queryのデータと比較
      console.log('React Queryのプロジェクト:', projects)
      console.log('同一性チェック:', directProjects === projects)
      console.log('長さチェック:', directProjects.length, 'vs', projects.length)
      
      if (directProjects.length > 0) {
        const directBigTasks = await bigTaskRepository.getByProjectId(directProjects[0].id)
        console.log('IndexedDBから直接取得したBigTasks:', directBigTasks)
      }
      
      // useProjects フックの返り値を直接確認
      console.log('useProjects フックの返り値全体:', {
        data: projects,
        isLoading: projectsLoading,
        error: projectsError,
      })
    } catch (error) {
      console.error('IndexedDB確認エラー:', error)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">全エンティティ同期テスト</h1>

      <div className="mb-4 flex gap-2">
        <Button
          onClick={refreshData}
          variant="outline"
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          データを更新
        </Button>
        <Button
          onClick={manualSync}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          手動同期
        </Button>
        <Button
          onClick={checkIndexedDB}
          variant="outline"
          size="sm"
        >
          DB確認
        </Button>
      </div>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="mood">Mood/Dopamine</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Projects ({projects.length})</h2>
              <Button
                onClick={() => createTestData('project')}
                disabled={loading}
                size="sm"
              >
                テストプロジェクトを作成
              </Button>
            </div>
            
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">プロジェクトがありません</p>
                <Button
                  onClick={refreshData}
                  variant="outline"
                  size="sm"
                >
                  再読み込み
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <div 
                    key={project.id} 
                    className={`flex justify-between items-center p-3 border rounded cursor-pointer hover:bg-background ${
                      selectedProjectId === project.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        締切: {new Date(project.deadline).toLocaleDateString()} | 
                        ステータス: {project.status}
                      </p>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        addToQueue('project', project)
                      }}
                      disabled={loading}
                      size="sm"
                      variant="outline"
                    >
                      同期キューに追加
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          {selectedProjectId ? (
            <>
              <Card className="p-4 mb-4">
                <h2 className="text-lg font-semibold mb-4">
                  Big Tasks ({bigTasks.length})
                  {projects.find(p => p.id === selectedProjectId) && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      - {projects.find(p => p.id === selectedProjectId)?.name}
                    </span>
                  )}
                </h2>
                {bigTasks.length === 0 ? (
                  <p className="text-muted-foreground">選択されたプロジェクトに大タスクがありません</p>
                ) : (
                  <div className="space-y-2">
                    {bigTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className={`flex justify-between items-center p-3 border rounded cursor-pointer hover:bg-background ${
                          selectedBigTaskId === task.id ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedBigTaskId(task.id)}
                      >
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-sm text-muted-foreground">
                            カテゴリー: {task.category || 'その他'}
                          </p>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            addToQueue('big_task', task)
                          }}
                          disabled={loading}
                          size="sm"
                          variant="outline"
                        >
                          同期キューに追加
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {selectedBigTaskId && (
                <Card className="p-4">
                  <h2 className="text-lg font-semibold mb-4">
                    Small Tasks ({smallTasks.length})
                    {bigTasks.find(t => t.id === selectedBigTaskId) && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        - {bigTasks.find(t => t.id === selectedBigTaskId)?.name}
                      </span>
                    )}
                  </h2>
                  {smallTasks.length === 0 ? (
                    <p className="text-muted-foreground">選択された大タスクに小タスクがありません</p>
                  ) : (
                    <div className="space-y-2">
                      {smallTasks.map((task) => (
                        <div key={task.id} className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <p className="font-medium">{task.name}</p>
                            <p className="text-sm text-muted-foreground">
                              予定: {task.estimated_minutes}分
                            </p>
                          </div>
                          <Button
                            onClick={() => addToQueue('small_task', task)}
                            disabled={loading}
                            size="sm"
                            variant="outline"
                          >
                            同期キューに追加
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card className="p-4">
              <p className="text-center text-muted-foreground py-8">
                プロジェクトを選択してください
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mood">
          <Card className="p-4 mb-4">
            <h2 className="text-lg font-semibold mb-4">Mood/Dopamine Entries</h2>
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => createTestData('mood_entry')}
                disabled={loading}
                size="sm"
              >
                テストMoodエントリーを作成
              </Button>
              <Button
                onClick={() => createTestData('dopamine_entry')}
                disabled={loading}
                size="sm"
              >
                テストDopamineエントリーを作成
              </Button>
            </div>
            
            {/* Mood Entries */}
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-medium mb-2">Mood Entries ({moodEntries.length})</h3>
                {moodEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Moodエントリーがありません</p>
                ) : (
                  <div className="space-y-2">
                    {moodEntries.map((entry) => (
                      <div key={entry.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium">気分レベル: {entry.mood_level}/10</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString('ja-JP')}
                          </p>
                          {entry.notes && <p className="text-sm">{entry.notes}</p>}
                        </div>
                        <Button
                          onClick={() => addToQueue('mood_entry', entry)}
                          disabled={loading}
                          size="sm"
                          variant="outline"
                        >
                          同期キューに追加
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Dopamine Entries */}
              <div>
                <h3 className="text-md font-medium mb-2">Dopamine Entries ({dopamineEntries.length})</h3>
                {dopamineEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Dopamineエントリーがありません</p>
                ) : (
                  <div className="space-y-2">
                    {dopamineEntries.map((entry) => (
                      <div key={entry.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium">{entry.event_description}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString('ja-JP')}
                          </p>
                          {entry.notes && <p className="text-sm">{entry.notes}</p>}
                        </div>
                        <Button
                          onClick={() => addToQueue('dopamine_entry', entry)}
                          disabled={loading}
                          size="sm"
                          variant="outline"
                        >
                          同期キューに追加
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}