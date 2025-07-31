/**
 * WorkSessionEditDialog - WorkSessionの編集・削除ダイアログ
 */

'use client'

import { useState, useEffect } from 'react'
import { WorkSession, SmallTask, Project } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Trash2, Clock, Brain } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WorkSessionEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: WorkSession | null
  task?: SmallTask
  project?: Project
  onUpdate: (sessionId: string, updates: Partial<WorkSession>) => Promise<void>
  onDelete: (sessionId: string) => Promise<void>
}

export function WorkSessionEditDialog({
  open,
  onOpenChange,
  session,
  task,
  project,
  onUpdate,
  onDelete,
}: WorkSessionEditDialogProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // フォームの状態
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [focusLevel, setFocusLevel] = useState<string>('')
  
  // ダイアログが開かれたときにフォームを初期化
  useEffect(() => {
    if (session && open) {
      const start = parseISO(session.start_time)
      setStartTime(format(start, 'HH:mm'))
      
      if (session.end_time) {
        const end = parseISO(session.end_time)
        setEndTime(format(end, 'HH:mm'))
      } else {
        setEndTime('')
      }
      
      setFocusLevel(session.focus_level?.toString() || '')
    }
  }, [session, open])
  
  if (!session) return null
  
  const handleUpdate = async () => {
    try {
      setIsUpdating(true)
      
      const updates: Partial<WorkSession> = {}
      const sessionDate = parseISO(session.start_time)
      
      // 開始時刻の更新
      const [startHours, startMinutes] = startTime.split(':').map(Number)
      const newStartTime = new Date(sessionDate)
      newStartTime.setHours(startHours, startMinutes, 0, 0)
      updates.start_time = newStartTime.toISOString()
      
      // 終了時刻の更新（入力されている場合）
      if (endTime) {
        const [endHours, endMinutes] = endTime.split(':').map(Number)
        const newEndTime = new Date(sessionDate)
        newEndTime.setHours(endHours, endMinutes, 0, 0)
        
        // 終了時刻が開始時刻より後かチェック
        if (newEndTime <= newStartTime) {
          toast({
            title: 'エラー',
            description: '終了時刻は開始時刻より後にしてください',
            variant: 'destructive',
          })
          return
        }
        
        updates.end_time = newEndTime.toISOString()
        updates.duration_minutes = Math.floor((newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60))
      }
      
      // 集中度の更新
      if (focusLevel) {
        const level = parseInt(focusLevel)
        if (level >= 1 && level <= 9) {
          updates.focus_level = level
        }
      }
      
      await onUpdate(session.id, updates)
      
      toast({
        title: '更新しました',
        description: 'セッション情報を更新しました',
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to update session:', error)
      toast({
        title: 'エラー',
        description: '更新に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }
  
  const handleDelete = async () => {
    try {
      setIsUpdating(true)
      await onDelete(session.id)
      
      toast({
        title: '削除しました',
        description: 'セッションを削除しました',
      })
      
      setShowDeleteDialog(false)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to delete session:', error)
      toast({
        title: 'エラー',
        description: '削除に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }
  
  const isActive = !session.end_time
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>セッションの編集</DialogTitle>
            <DialogDescription>
              {task ? (
                <>
                  {task.name}
                  {project && <span className="text-muted-foreground"> - {project.name}</span>}
                </>
              ) : (
                session.mood_notes || 'タスクなし'
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-time" className="text-right">
                開始時刻
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isActive}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-time" className="text-right">
                終了時刻
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder={isActive ? '実行中...' : '未設定'}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="focus-level" className="text-right">
                集中度
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <Select value={focusLevel || 'none'} onValueChange={(value) => setFocusLevel(value === 'none' ? '' : value)}>
                  <SelectTrigger id="focus-level">
                    <SelectValue placeholder="集中度を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未設定</SelectItem>
                    {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => (
                      <SelectItem key={level} value={level.toString()}>
                        {level} - {
                          level >= 8 ? '最高の集中' :
                          level >= 6 ? '良好' :
                          level >= 4 ? '普通' :
                          '低い'
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {session.duration_seconds && session.duration_seconds > 0 && (
              <div className="text-sm text-muted-foreground text-center">
                現在の記録時間: {Math.floor(session.duration_seconds / 60)}分
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isUpdating || isActive}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isUpdating}
              >
                更新
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>セッションを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。セッションの記録が完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}