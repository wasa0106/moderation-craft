/**
 * RecordDetailDialog - 記録詳細表示・編集ダイアログ
 */

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { DopamineEntry, MoodEntry } from '@/types'
import { Sparkles, Brain, Clock, Edit, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface RecordDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: { type: 'dopamine' | 'mood'; data: DopamineEntry | MoodEntry } | null
  onUpdate?: (type: 'dopamine' | 'mood', id: string, data: any) => Promise<void>
  onDelete?: (type: 'dopamine' | 'mood', id: string) => Promise<void>
}

export function RecordDetailDialog({
  open,
  onOpenChange,
  record,
  onUpdate,
  onDelete,
}: RecordDetailDialogProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 編集用のステート
  const [editData, setEditData] = useState<any>({})

  // ダイアログが開いたときに編集データを初期化
  useEffect(() => {
    if (open && record) {
      if (record.type === 'dopamine') {
        const dopamineData = record.data as DopamineEntry
        setEditData({
          timestamp: dopamineData.timestamp,
          event_description: dopamineData.event_description,
        })
      } else {
        const moodData = record.data as MoodEntry
        setEditData({
          timestamp: moodData.timestamp,
          mood_level: moodData.mood_level || 5,
          notes: moodData.notes || '',
        })
      }
      setIsEditMode(false)
    }
  }, [open, record])

  if (!record) return null

  const getMoodLevelLabel = (level: number): string => {
    const labels = [
      '', // 0は使わない
      '最悪',
      'とても悪い',
      '悪い',
      'やや悪い',
      '普通',
      'やや良い',
      '良い',
      'とても良い',
      '最高',
    ]
    return labels[level] || '不明'
  }

  const getMoodLevelColor = (level: number): string => {
    if (level >= 8) return 'text-green-600'
    if (level >= 6) return 'text-blue-600'
    if (level >= 4) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleSave = async () => {
    if (!onUpdate) return

    setIsSubmitting(true)
    try {
      await onUpdate(record.type, record.data.id, editData)
      setIsEditMode(false)
      toast.success('記録を更新しました')
    } catch (error) {
      console.error('Failed to update record:', error)
      toast.error('更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setIsSubmitting(true)
    try {
      await onDelete(record.type, record.data.id)
      onOpenChange(false)
      toast.success('記録を削除しました')
    } catch (error) {
      console.error('Failed to delete record:', error)
      toast.error('削除に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {record.type === 'dopamine' ? (
              <>
                <Sparkles className="h-5 w-5 text-yellow-500" />
                ドーパミン記録
              </>
            ) : (
              <>
                <Brain className="h-5 w-5 text-blue-500" />
                感情記録
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {format(
              new Date(
                record.type === 'dopamine'
                  ? (record.data as DopamineEntry).timestamp
                  : (record.data as MoodEntry).timestamp
              ),
              'yyyy年M月d日(E) HH:mm',
              { locale: ja }
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {isEditMode ? (
            // 編集モード
            <>
              {record.type === 'dopamine' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="timestamp">記録時刻</Label>
                    <Input
                      id="timestamp"
                      type="datetime-local"
                      value={editData.timestamp ? parseISO(editData.timestamp).toISOString().slice(0, 16) : ''}
                      onChange={(e) =>
                        setEditData({ ...editData, timestamp: new Date(e.target.value).toISOString() })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event_description">出来事</Label>
                    <Textarea
                      id="event_description"
                      value={editData.event_description || ''}
                      onChange={(e) =>
                        setEditData({ ...editData, event_description: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="timestamp">記録時刻</Label>
                    <Input
                      id="timestamp"
                      type="datetime-local"
                      value={editData.timestamp ? parseISO(editData.timestamp).toISOString().slice(0, 16) : ''}
                      onChange={(e) =>
                        setEditData({ ...editData, timestamp: new Date(e.target.value).toISOString() })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mood_level">
                      気分レベル: {editData.mood_level || 5} - {getMoodLevelLabel(editData.mood_level || 5)}
                    </Label>
                    <Slider
                      id="mood_level"
                      value={[editData.mood_level || 5]}
                      onValueChange={(value) =>
                        setEditData({ ...editData, mood_level: value[0] })
                      }
                      min={1}
                      max={9}
                      step={1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                      <span>6</span>
                      <span>7</span>
                      <span>8</span>
                      <span>9</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">メモ</Label>
                    <Textarea
                      id="notes"
                      value={editData.notes || ''}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      rows={3}
                      placeholder="その時の状況や感じたことを記録"
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            // 表示モード
            <>
              {record.type === 'dopamine' ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      記録時刻
                    </div>
                    <p className="text-sm">
                      {format(
                        new Date((record.data as DopamineEntry).timestamp),
                        'HH:mm:ss',
                        { locale: ja }
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">出来事</div>
                    <p className="text-sm whitespace-pre-wrap">
                      {(record.data as DopamineEntry).event_description}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      記録時刻
                    </div>
                    <p className="text-sm">
                      {format(
                        new Date((record.data as MoodEntry).timestamp),
                        'HH:mm:ss',
                        { locale: ja }
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">気分レベル</div>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold">
                        {(record.data as MoodEntry).mood_level}
                      </div>
                      <div className={cn(
                        'text-sm font-medium',
                        getMoodLevelColor((record.data as MoodEntry).mood_level)
                      )}>
                        {getMoodLevelLabel((record.data as MoodEntry).mood_level)}
                      </div>
                    </div>
                  </div>

                  {(record.data as MoodEntry).notes && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">メモ</div>
                      <p className="text-sm whitespace-pre-wrap">
                        {(record.data as MoodEntry).notes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditMode(false)}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
              <Button onClick={handleSave} disabled={isSubmitting}>
                保存
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={!onDelete || isSubmitting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                削除
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
                disabled={!onUpdate}
              >
                <Edit className="h-4 w-4 mr-1" />
                編集
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}