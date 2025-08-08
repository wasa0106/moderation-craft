/**
 * DopamineDialog - ドーパミン入力ダイアログ
 */

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { SyncService } from '@/lib/sync/sync-service'
import { toast } from 'sonner'

interface DopamineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onSuccess?: () => void
}

export function DopamineDialog({ open, onOpenChange, userId, onSuccess }: DopamineDialogProps) {
  const [eventDescription, setEventDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timestamp, setTimestamp] = useState<Date | null>(null)
  const syncService = SyncService.getInstance()
  const eventDescriptionRef = useRef<HTMLTextAreaElement>(null)

  // Initialize timestamp on client side
  useEffect(() => {
    if (!timestamp) {
      setTimestamp(new Date())
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!eventDescription.trim()) return
    
    // 二重実行防止
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const data: CreateDopamineEntryData = {
        user_id: userId,
        event_description: eventDescription.trim(),
        timestamp: timestamp ? timestamp.toISOString() : new Date().toISOString(),
      }

      // IndexedDBに保存
      const entry = await dopamineEntryRepository.create(data)

      // 同期キューに追加（オンライン復帰時に自動同期）
      await syncService.addToSyncQueue('dopamine_entry', entry.id, 'create', entry)

      // 成功メッセージ
      toast.success('ドーパミンイベントを記録しました', {
        description: eventDescription.trim(),
      })

      // 成功コールバックを呼び出す
      if (onSuccess) {
        onSuccess()
      }

      // リセット
      setEventDescription('')
      onOpenChange(false)
    } catch (error) {
      console.error('ドーパミンイベントの保存に失敗しました:', error)
      toast.error('記録の保存に失敗しました', {
        description: '再度お試しください',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [eventDescription, isSubmitting, userId, timestamp, onSuccess, onOpenChange])

  // キーボードショートカット
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Shiftを押している場合のEnterキーで確定
      if (e.key === 'Enter' && e.shiftKey && !isSubmitting) {
        e.preventDefault()
        handleSubmit()
      }
      // 通常のEnterは何もしない（テキストエリアでの改行のため）
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, isSubmitting, handleSubmit])

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
              ref={eventDescriptionRef}
              id="event-description"
              value={eventDescription}
              onChange={e => setEventDescription(e.target.value)}
              placeholder="出来事を記録してください..."
              onKeyDown={(e) => {
                // Shiftを押している場合のEnterキーで確定
                if (e.key === 'Enter' && e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
                // 通常のEnterはデフォルトの改行動作
              }}
              rows={3}
              className="resize-none"
              autoFocus
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
