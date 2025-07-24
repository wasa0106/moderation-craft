/**
 * TaskManagementPage - WBS・タスク管理ページ
 * プロジェクトの大タスクと小タスクを管理するページ
 */

'use client'

import { useState, useEffect } from 'react'
import { BigTaskForm } from '@/components/task/big-task-form'
import { SmallTaskForm } from '@/components/task/small-task-form'
import { BigTaskList } from '@/components/task/big-task-list'
import { SmallTaskList } from '@/components/task/small-task-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import {
  CreateBigTaskData,
  CreateSmallTaskData,
  UpdateBigTaskData,
  UpdateSmallTaskData,
  BigTask,
  SmallTask,
} from '@/types'
import { ArrowLeft, Plus, Target, CheckCircle2, Calendar } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface TaskManagementPageProps {
  params: Promise<{
    id: string
  }>
}

export default function TaskManagementPage({ params }: TaskManagementPageProps) {
  const { projects } = useProjects('current-user')
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)

  // Resolve params promise
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  const {
    bigTasks,
    createBigTask,
    updateBigTask,
    deleteBigTask,
    isLoading: bigTasksLoading,
  } = useBigTasks(resolvedParams?.id || '')
  const {
    smallTasks,
    createSmallTask,
    updateSmallTask,
    deleteSmallTask,
    isLoading: smallTasksLoading,
  } = useSmallTasks(resolvedParams?.id || '')

  const [showBigTaskForm, setShowBigTaskForm] = useState(false)
  const [showSmallTaskForm, setShowSmallTaskForm] = useState(false)
  const [selectedBigTask, setSelectedBigTask] = useState<BigTask | null>(null)
  const [selectedSmallTask, setSelectedSmallTask] = useState<SmallTask | null>(null)
  const [selectedBigTaskForSmallTask, setSelectedBigTaskForSmallTask] = useState<string | null>(
    null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const project = resolvedParams?.id ? projects.find(p => p.id === resolvedParams.id) : undefined
  const projectBigTasks = resolvedParams?.id ? bigTasks.filter(task => task.project_id === resolvedParams.id) : []
  const projectSmallTasks = smallTasks.filter(task =>
    projectBigTasks.some(bigTask => bigTask.id === task.big_task_id)
  )

  if (!resolvedParams) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">プロジェクトが見つかりません</h2>
          <p className="text-gray-600 mb-6">
            指定されたプロジェクトは存在しないか、削除されています。
          </p>
          <Link href="/projects">
            <Button>プロジェクト一覧に戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Handle Big Task operations
  const handleCreateBigTask = async (data: CreateBigTaskData) => {
    setIsSubmitting(true)

    try {
      await createBigTask(data)
      toast.success('大タスクが正常に作成されました')
      setShowBigTaskForm(false)
      setSelectedBigTask(null)
    } catch (error) {
      console.error('Failed to create big task:', error)
      toast.error('大タスクの作成に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateBigTask = async (data: UpdateBigTaskData) => {
    if (!selectedBigTask) return

    setIsSubmitting(true)

    try {
      await updateBigTask({ id: selectedBigTask.id, data })
      toast.success('大タスクが正常に更新されました')
      setShowBigTaskForm(false)
      setSelectedBigTask(null)
    } catch (error) {
      console.error('Failed to update big task:', error)
      toast.error('大タスクの更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBigTask = async (taskId: string) => {
    if (!confirm('この大タスクを削除しますか？関連する小タスクも削除されます。')) {
      return
    }

    try {
      await deleteBigTask(taskId)
      toast.success('大タスクが正常に削除されました')
    } catch (error) {
      console.error('Failed to delete big task:', error)
      toast.error('大タスクの削除に失敗しました')
    }
  }

  // Handle Small Task operations
  const handleCreateSmallTask = async (data: CreateSmallTaskData) => {
    setIsSubmitting(true)

    try {
      await createSmallTask(data)
      toast.success('小タスクが正常に作成されました')
      setShowSmallTaskForm(false)
      setSelectedSmallTask(null)
      setSelectedBigTaskForSmallTask(null)
    } catch (error) {
      console.error('Failed to create small task:', error)
      toast.error('小タスクの作成に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateSmallTask = async (data: UpdateSmallTaskData) => {
    if (!selectedSmallTask) return

    setIsSubmitting(true)

    try {
      await updateSmallTask({ id: selectedSmallTask.id, data })
      toast.success('小タスクが正常に更新されました')
      setShowSmallTaskForm(false)
      setSelectedSmallTask(null)
    } catch (error) {
      console.error('Failed to update small task:', error)
      toast.error('小タスクの更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSmallTask = async (taskId: string) => {
    if (!confirm('この小タスクを削除しますか？')) {
      return
    }

    try {
      await deleteSmallTask(taskId)
      toast.success('小タスクが正常に削除されました')
    } catch (error) {
      console.error('Failed to delete small task:', error)
      toast.error('小タスクの削除に失敗しました')
    }
  }

  // Edit handlers
  const handleEditBigTask = (task: BigTask) => {
    setSelectedBigTask(task)
    setShowBigTaskForm(true)
  }

  const handleEditSmallTask = (task: SmallTask) => {
    setSelectedSmallTask(task)
    setShowSmallTaskForm(true)
  }

  const handleCreateSmallTaskForBigTask = (bigTaskId: string) => {
    setSelectedBigTaskForSmallTask(bigTaskId)
    setShowSmallTaskForm(true)
  }

  // Calculate statistics
  const stats = {
    bigTasks: {
      total: projectBigTasks.length,
      completed: projectBigTasks.filter(t => t.status === 'completed').length,
      active: projectBigTasks.filter(t => t.status === 'active').length,
      pending: projectBigTasks.filter(t => t.status === 'pending').length,
    },
    smallTasks: {
      total: projectSmallTasks.length,
      completed: projectSmallTasks.filter(t => t.actual_minutes && t.actual_minutes > 0).length,
      pending: projectSmallTasks.filter(t => !t.actual_minutes || t.actual_minutes === 0).length,
      emergency: projectSmallTasks.filter(t => t.is_emergency).length,
    },
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/projects/${resolvedParams.id}`}>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              プロジェクト詳細に戻る
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Target className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">タスク管理</h1>
              <p className="text-gray-600">{project.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/schedule">
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                スケジュール
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">大タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.bigTasks.completed}/{stats.bigTasks.total}
            </div>
            <div className="text-sm text-gray-500">完了 / 総数</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">小タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.smallTasks.completed}/{stats.smallTasks.total}
            </div>
            <div className="text-sm text-gray-500">完了 / 総数</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">実行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.bigTasks.active}</div>
            <div className="text-sm text-gray-500">大タスク</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">緊急</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.smallTasks.emergency}</div>
            <div className="text-sm text-gray-500">小タスク</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="big-tasks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="big-tasks">大タスク (WBS)</TabsTrigger>
          <TabsTrigger value="small-tasks">小タスク</TabsTrigger>
        </TabsList>

        {/* Big Tasks Tab */}
        <TabsContent value="big-tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  大タスク一覧
                </CardTitle>
                <Dialog open={showBigTaskForm} onOpenChange={setShowBigTaskForm}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedBigTask(null)}>
                      <Plus className="h-4 w-4 mr-2" />
                      大タスクを作成
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>
                        {selectedBigTask ? '大タスクを編集' : '新しい大タスクを作成'}
                      </DialogTitle>
                    </DialogHeader>
                    <BigTaskForm
                      projectId={resolvedParams.id}
                      task={selectedBigTask || undefined}
                      onSubmit={selectedBigTask ? handleUpdateBigTask : handleCreateBigTask}
                      onCancel={() => {
                        setShowBigTaskForm(false)
                        setSelectedBigTask(null)
                      }}
                      isLoading={isSubmitting}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <BigTaskList
                bigTasks={projectBigTasks}
                onEdit={handleEditBigTask}
                onDelete={handleDeleteBigTask}
                onCreateSmallTask={handleCreateSmallTaskForBigTask}
                isLoading={bigTasksLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Small Tasks Tab */}
        <TabsContent value="small-tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  小タスク一覧
                </CardTitle>
                <Dialog open={showSmallTaskForm} onOpenChange={setShowSmallTaskForm}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setSelectedSmallTask(null)
                        setSelectedBigTaskForSmallTask(null)
                      }}
                      disabled={projectBigTasks.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      小タスクを作成
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>
                        {selectedSmallTask ? '小タスクを編集' : '新しい小タスクを作成'}
                      </DialogTitle>
                    </DialogHeader>
                    {(selectedSmallTask || selectedBigTaskForSmallTask) && (
                      <SmallTaskForm
                        bigTaskId={
                          selectedBigTaskForSmallTask || selectedSmallTask?.big_task_id || ''
                        }
                        task={selectedSmallTask || undefined}
                        onSubmit={selectedSmallTask ? handleUpdateSmallTask : handleCreateSmallTask}
                        onCancel={() => {
                          setShowSmallTaskForm(false)
                          setSelectedSmallTask(null)
                          setSelectedBigTaskForSmallTask(null)
                        }}
                        isLoading={isSubmitting}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {projectBigTasks.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    小タスクを作成するには、まず大タスクを作成してください
                  </p>
                </div>
              ) : (
                <SmallTaskList
                  smallTasks={projectSmallTasks}
                  bigTasks={projectBigTasks}
                  onEdit={handleEditSmallTask}
                  onDelete={handleDeleteSmallTask}
                  isLoading={smallTasksLoading}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
