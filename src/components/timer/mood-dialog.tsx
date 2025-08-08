/**
 * MoodDialog - 感情入力ダイアログ
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
import { Slider } from '@/components/ui/slider'
import { moodEntryRepository } from '@/lib/db/repositories'
import { CreateMoodEntryData } from '@/types'
import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SyncService } from '@/lib/sync/sync-service'
import { toast } from 'sonner'

interface MoodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onSuccess?: () => void
}

export function MoodDialog({ open, onOpenChange, userId, onSuccess }: MoodDialogProps) {
  const [moodLevel, setMoodLevel] = useState<number>(5)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const syncService = SyncService.getInstance()
  const sliderRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ダイアログが開いたときにデフォルト値をリセット
  useEffect(() => {
    if (open) {
      setMoodLevel(5)
      setNotes('')
      setIsSuccess(false)
      // スライダーにフォーカスを当てる
      setTimeout(() => {
        const slider = sliderRef.current?.querySelector('[role="slider"]') as HTMLElement
        slider?.focus()
      }, 100)
    }
  }, [open])

  const handleSubmit = useCallback(async () => {
    // 二重実行防止
    if (isSubmitting) return
    
    setIsSubmitting(true)
    try {
      const data: CreateMoodEntryData = {
        user_id: userId,
        mood_level: moodLevel,
        notes: notes || undefined,
        timestamp: new Date().toISOString(),
      }

      // IndexedDBに保存
      const entry = await moodEntryRepository.create(data)

      // 同期キューに追加（オンライン復帰時に自動同期）
      await syncService.addToSyncQueue('mood_entry', entry.id, 'create', entry)

      // 成功状態を表示
      setIsSuccess(true)
      toast.success('感情を記録しました', {
        description: `気分レベル: ${moodLevel}`,
        icon: <CheckCircle className="w-4 h-4" />,
      })

      // 成功コールバックを呼び出す
      if (onSuccess) {
        onSuccess()
      }

      // 少し待ってからダイアログを閉じる
      setTimeout(() => {
        setMoodLevel(5)
        setNotes('')
        setIsSuccess(false)
        onOpenChange(false)
      }, 1000)
    } catch (error) {
      console.error('感情記録の保存に失敗しました:', error)
      toast.error('記録の保存に失敗しました', {
        description: '再度お試しください',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, userId, moodLevel, notes, onSuccess, onOpenChange])

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

  // ダイアログを閉じる時にステートをリセット
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      setMoodLevel(5)
      setNotes('')
      setIsSuccess(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>今の気分を記録</DialogTitle>
          <DialogDescription>現在の感情レベルを選択してください</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-4">
            <div ref={sliderRef}>
              <Slider
                value={[moodLevel]}
                onValueChange={(value) => setMoodLevel(value[0])}
                min={1}
                max={9}
                step={1}
                className="w-full"
              />
            </div>
            
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

            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  // Shiftを押している場合のEnterキーで確定
                  if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                  // 通常のEnterはデフォルトの改行動作
                }}
                placeholder="今の気分について詳しく記録できます..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isSuccess}
            className={cn('w-full', isSuccess && 'bg-primary hover:bg-primary/90')}
          >
            {isSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                保存しました
              </>
            ) : isSubmitting ? (
              '保存中...'
            ) : (
              '確定'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
