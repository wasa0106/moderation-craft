/**
 * DopamineDialog - ドーパミン入力ダイアログ
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { dopamineEntryRepository } from '@/lib/db/repositories'
import { CreateDopamineEntryData } from '@/types'
import { Sparkles, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface DopamineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

export function DopamineDialog({ open, onOpenChange, userId }: DopamineDialogProps) {
  const [eventDescription, setEventDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timestamp, setTimestamp] = useState<Date | null>(null)

  // Initialize timestamp on client side
  useEffect(() => {
    if (!timestamp) {
      setTimestamp(new Date())
    }
  }, [])

  const handleSubmit = async () => {
    if (!eventDescription.trim()) return

    setIsSubmitting(true)
    try {
      const data: CreateDopamineEntryData = {
        user_id: userId,
        event_description: eventDescription.trim(),
        notes: notes.trim() || undefined,
        timestamp: timestamp ? timestamp.toISOString() : new Date().toISOString(),
      }

      await dopamineEntryRepository.create(data)

      // リセット
      setEventDescription('')
      setNotes('')
      onOpenChange(false)
    } catch (error) {
      console.error('ドーパミンイベントの保存に失敗しました:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            ドーパミンイベントを記録
          </DialogTitle>
          <DialogDescription>嬉しかったことや達成感を感じた瞬間を記録しましょう</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 発生時刻 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {timestamp ? format(timestamp, 'yyyy年MM月dd日 HH:mm', { locale: ja }) : ''}
            </span>
          </div>

          {/* イベント説明 */}
          <div className="space-y-2">
            <Label htmlFor="event-description">
              何があったか？ <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="event-description"
              placeholder="例: 難しいバグを解決できた！新しい機能が完成した！など"
              value={eventDescription}
              onChange={e => setEventDescription(e.target.value)}
              rows={3}
              className="resize-none"
              autoFocus
            />
          </div>

          {/* 追加メモ */}
          <div className="space-y-2">
            <Label htmlFor="dopamine-notes">詳細メモ（任意）</Label>
            <Textarea
              id="dopamine-notes"
              placeholder="その時の気持ちや詳しい状況など..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!eventDescription.trim() || isSubmitting}>
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
