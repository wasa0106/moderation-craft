/**
 * MoodDialog - 感情入力ダイアログ
 */

import { useState } from 'react'
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
import { moodEntryRepository } from '@/lib/db/repositories'
import { CreateMoodEntryData } from '@/types'
import { Smile, Frown, Meh, Heart, Angry, Sparkles, Brain, Zap, CloudRain, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SyncService } from '@/lib/sync/sync-service'
import { toast } from 'sonner'

interface MoodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

const moodLevels = [
  { value: 1, icon: Angry, label: 'とても悪い', color: 'text-red-600' },
  { value: 2, icon: Frown, label: '悪い', color: 'text-orange-600' },
  { value: 3, icon: CloudRain, label: 'やや悪い', color: 'text-orange-500' },
  { value: 4, icon: Meh, label: '普通', color: 'text-yellow-600' },
  { value: 5, icon: Smile, label: 'まあまあ', color: 'text-yellow-500' },
  { value: 6, icon: Heart, label: '良い', color: 'text-green-500' },
  { value: 7, icon: Brain, label: 'とても良い', color: 'text-green-600' },
  { value: 8, icon: Sparkles, label: '素晴らしい', color: 'text-blue-600' },
  { value: 9, icon: Zap, label: '最高！', color: 'text-purple-600' },
]

export function MoodDialog({ open, onOpenChange, userId }: MoodDialogProps) {
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const syncService = SyncService.getInstance()

  const handleSubmit = async () => {
    if (!selectedMood) return

    setIsSubmitting(true)
    try {
      const data: CreateMoodEntryData = {
        user_id: userId,
        mood_level: selectedMood,
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
        description: `気分レベル: ${selectedMood}`,
        icon: <CheckCircle className="w-4 h-4" />,
      })
      
      // 少し待ってからダイアログを閉じる
      setTimeout(() => {
        setSelectedMood(null)
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
  }

  // ダイアログを閉じる時にステートをリセット
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      setSelectedMood(null)
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
          <DialogDescription>
            現在の感情レベルを選択してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 感情レベル選択 */}
          <div className="space-y-2">
            <Label>感情レベル</Label>
            <div className="grid grid-cols-3 gap-3">
              {moodLevels.map(level => {
                const Icon = level.icon
                const isSelected = selectedMood === level.value
                
                return (
                  <button
                    key={level.value}
                    onClick={() => setSelectedMood(level.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                      'hover:bg-muted/50',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border'
                    )}
                  >
                    <Icon className={cn('h-8 w-8', level.color)} />
                    <span className="text-xs font-medium">{level.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* メモ入力 */}
          <div className="space-y-2">
            <Label htmlFor="mood-notes">メモ（任意）</Label>
            <Textarea
              id="mood-notes"
              placeholder="今の気分について詳しく記録できます..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedMood || isSubmitting || isSuccess}
            className={cn(isSuccess && 'bg-green-600 hover:bg-green-700')}
          >
            {isSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                保存しました
              </>
            ) : isSubmitting ? (
              '保存中...'
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}