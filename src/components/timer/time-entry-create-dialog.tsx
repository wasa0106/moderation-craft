/**
 * TimeEntryCreateDialog - 時間エントリ作成用ダイアログ
 * クリック&ドラッグで選択した時間範囲にタスクを割り当てる
 */

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Search, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SmallTask, Project, BigTask } from '@/types'
import { cn } from '@/lib/utils'
import { useCreateSmallTask } from '@/hooks/use-small-tasks'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useCreateTimeEntry } from '@/hooks/use-time-entries'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TimeEntryCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime: Date | null
  endTime: Date | null
  tasks: SmallTask[]
  projects: Project[]
  onCreateEntry: (taskId: string) => void
}

export function TimeEntryCreateDialog({
  open,
  onOpenChange,
  startTime,
  endTime,
  tasks,
  projects,
  onCreateEntry,
}: TimeEntryCreateDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isCreatingNewTask, setIsCreatingNewTask] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedBigTaskId, setSelectedBigTaskId] = useState<string>('')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Hooks for creating new task
  const { createSmallTask } = useCreateSmallTask('current-user')
  const { bigTasks } = useBigTasks('current-user')
  const { mutate: createTimeEntry } = useCreateTimeEntry('current-user')

  // タスクのフィルタリングとグループ化
  const groupedTasks = useMemo(() => {
    const filtered = tasks.filter(task => 
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      projects.find(p => p.id === task.project_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // プロジェクトごとにグループ化
    const grouped = new Map<string, SmallTask[]>()
    
    // ルーティンタスク
    const routineTasks = filtered.filter(t => t.task_type === 'routine')
    if (routineTasks.length > 0) {
      grouped.set('routine', routineTasks)
    }

    // プロジェクトタスク
    projects.forEach(project => {
      const projectTasks = filtered.filter(t => t.project_id === project.id)
      if (projectTasks.length > 0) {
        grouped.set(project.id, projectTasks)
      }
    })

    return grouped
  }, [tasks, projects, searchQuery])

  // 選択中のタスクとプロジェクトを取得
  const selectedTask = tasks.find(t => t.id === selectedTaskId)
  const selectedProject = selectedTask?.project_id 
    ? projects.find(p => p.id === selectedTask.project_id)
    : null

  // 時間の計算
  const duration = startTime && endTime 
    ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
    : 0

  const handleSubmit = async () => {
    if (isCreatingNewTask && newTaskName && selectedProjectId && selectedBigTaskId) {
      setIsSubmitting(true)
      try {
        // Create new SmallTask (actual type - for tracking only)
        const newTask = await createSmallTask({
          user_id: 'current-user',
          project_id: selectedProjectId,
          big_task_id: selectedBigTaskId,
          name: newTaskName,
          estimated_minutes: estimatedMinutes,
          status: 'pending',
          task_type: 'actual', // 実績専用タスク
          scheduled_start: null,  // 予定には表示しない
          scheduled_end: null,    // 予定には表示しない
        })
        
        // Create TimeEntry for the new task
        if (startTime && endTime) {
          createTimeEntry({
            small_task_id: newTask.id,
            project_id: selectedProjectId,
            big_task_id: selectedBigTaskId,
            date: format(startTime, 'yyyy-MM-dd'),
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: duration,
            description: newTaskName,
          }, {
            onSuccess: () => {
              console.log('TimeEntry created successfully for new task')
              // Reset form and close dialog
              setNewTaskName('')
              setSelectedProjectId('')
              setSelectedBigTaskId('')
              setEstimatedMinutes(30)
              setIsCreatingNewTask(false)
              setSearchQuery('')
              onOpenChange(false)
            },
            onError: (error) => {
              console.error('Failed to create TimeEntry:', error)
            }
          })
        }
      } catch (error) {
        console.error('Failed to create new task:', error)
      } finally {
        setIsSubmitting(false)
      }
    } else if (selectedTaskId) {
      onCreateEntry(selectedTaskId)
      setSelectedTaskId(null)
      setSearchQuery('')
      onOpenChange(false)
    }
  }
  
  // Filter BigTasks by selected project
  const projectBigTasks = useMemo(() => {
    if (!selectedProjectId) return []
    return bigTasks.filter(bt => bt.project_id === selectedProjectId)
  }, [bigTasks, selectedProjectId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>実績時間の記録</DialogTitle>
          <DialogDescription>
            {startTime && endTime && (
              <>
                {format(startTime, 'HH:mm', { locale: ja })} - {format(endTime, 'HH:mm', { locale: ja })}
                （{duration}分）
              </>
            )}
            {(!startTime || !endTime) && '記録するタスクを選択してください'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 新規タスク作成ボタン */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setIsCreatingNewTask(!isCreatingNewTask)}
          >
            <Plus className="h-4 w-4 mr-2" />
            新規タスクを作成
          </Button>
          
          {/* 新規タスク作成フォーム */}
          {isCreatingNewTask && (
            <div className="space-y-3 p-3 border rounded-lg bg-surface-1">
              <div className="space-y-2">
                <Label>プロジェクト *</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="プロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color || '#666' }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>BigTask *</Label>
                <Select 
                  value={selectedBigTaskId} 
                  onValueChange={setSelectedBigTaskId}
                  disabled={!selectedProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="BigTaskを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectBigTasks.map(bigTask => (
                      <SelectItem key={bigTask.id} value={bigTask.id}>
                        {bigTask.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>タスク名 *</Label>
                <Input
                  placeholder="タスク名を入力"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>見積時間（分）</Label>
                <Input
                  type="number"
                  min="1"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          
          {/* 既存タスクの検索・選択 */}
          {!isCreatingNewTask && (
            <>
              {/* 検索フィールド */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="タスクを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* タスクリスト */}
              <ScrollArea className="h-[250px] border rounded-lg">
            <div className="p-2">
              {Array.from(groupedTasks.entries()).map(([groupId, groupTasks]) => {
                const project = groupId === 'routine' 
                  ? null 
                  : projects.find(p => p.id === groupId)
                
                return (
                  <div key={groupId} className="mb-4">
                    {/* グループヘッダー */}
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      {project && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color || '#666' }}
                        />
                      )}
                      <span>{project ? project.name : 'ルーティンタスク'}</span>
                    </div>

                    {/* タスクアイテム */}
                    <div className="space-y-1">
                      {groupTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md transition-colors',
                            'hover:bg-surface-1',
                            selectedTaskId === task.id && 'bg-primary/10 border border-primary'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate flex-1">
                              {task.name}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{task.estimated_minutes}分</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {groupedTasks.size === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  タスクが見つかりません
                </div>
              )}
            </div>
              </ScrollArea>
            </>
          )}

          {/* 選択中のタスク表示 */}
          {selectedTask && !isCreatingNewTask && (
            <div className="p-3 bg-surface-1 rounded-lg border">
              <div className="flex items-center gap-2">
                {selectedProject && (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedProject.color || '#666' }}
                  />
                )}
                <div className="flex-1">
                  <div className="font-medium text-sm">{selectedTask.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedProject?.name || 'ルーティンタスク'} • 予定: {selectedTask.estimated_minutes}分
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              isSubmitting ||
              (!selectedTaskId && !isCreatingNewTask) ||
              (isCreatingNewTask && (!newTaskName || !selectedProjectId || !selectedBigTaskId))
            }
          >
            {isSubmitting ? '作成中...' : isCreatingNewTask ? 'タスクを作成して記録' : '記録する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}