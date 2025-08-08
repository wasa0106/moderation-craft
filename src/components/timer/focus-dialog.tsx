/**
 * FocusDialog - 集中力入力ダイアログ
 */

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'

interface FocusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (focusLevel: number, workNotes?: string) => void
}

const focusLabels = [
  '眠い',
  'ぼんやり',
  '疲れ気味',
  '普通',
  'まあまあ',
  '集中',
  'かなり集中',
  '深い集中',
  'ゾーン！',
]

export function FocusDialog({ open, onOpenChange, onSubmit }: FocusDialogProps) {
  const [focusLevel, setFocusLevel] = useState<number>(5)
  const [workNotes, setWorkNotes] = useState<string>('')
  const sliderRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ダイアログが開いたときにデフォルト値をリセット
  useEffect(() => {
    if (open) {
      setFocusLevel(5)
      setWorkNotes('')
      // スライダーにフォーカスを当てる
      setTimeout(() => {
        const slider = sliderRef.current?.querySelector('[role="slider"]') as HTMLElement
        slider?.focus()
      }, 100)
    }
  }, [open])

  // キーボードショートカット
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Shiftを押している場合のEnterキーで確定
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        onSubmit(focusLevel, workNotes || undefined)
        onOpenChange(false)
      }
      // 通常のEnterは何もしない（テキストエリアでの改行のため）
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, focusLevel, workNotes, onSubmit, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>集中力レベルを記録</DialogTitle>
          <DialogDescription>作業中の集中度を9段階で評価してください</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-4">
            <div ref={sliderRef}>
              <Slider
                value={[focusLevel]}
                onValueChange={(value) => setFocusLevel(value[0])}
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
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                onKeyDown={(e) => {
                  // Shiftを押している場合のEnterキーで確定
                  if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault()
                    onSubmit(focusLevel, workNotes || undefined)
                    onOpenChange(false)
                  }
                  // 通常のEnterはデフォルトの改行動作
                }}
                placeholder="作業内容や気づきをメモ（任意）"
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              onSubmit(focusLevel, workNotes || undefined)
              onOpenChange(false)
            }}
            className="w-full"
          >
            確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
