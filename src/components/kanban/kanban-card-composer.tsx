'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImeAwareInput } from '@/hooks/use-ime-aware-input'

interface KanbanCardComposerProps {
  bigTaskId: string
  projectId?: string
  onCreateTask: (title: string) => Promise<void>
}

export function KanbanCardComposer({
  bigTaskId,
  projectId,
  onCreateTask,
}: KanbanCardComposerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleOpen = () => {
    setIsOpen(true)
    // 次のレンダリングサイクルでフォーカス
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  const handleCancel = () => {
    setIsOpen(false)
    setTitle('')
  }

  const handleSubmit = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onCreateTask(trimmedTitle)
      // 成功時は入力欄をクリアするが、フォームは開いたまま
      setTitle('')
      // 次の入力のためにフォーカスを維持
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)
    } catch (error) {
      // エラー時は開いたまま（エラー処理は親コンポーネントで）
      console.error('Failed to create task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // IME対応のキーボード処理
  const { handlers } = useImeAwareInput({
    onSubmit: handleSubmit,
    onCancel: handleCancel,
  })

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        aria-label="カードを追加"
        className="w-full text-left text-sm text-muted-foreground hover:bg-muted/50 rounded-md px-2 py-2 cursor-pointer transition-colors flex items-center gap-1"
      >
        <Plus className="h-4 w-4" />
        <span>カードを追加</span>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handlers.onKeyDown}
        onCompositionStart={handlers.onCompositionStart}
        onCompositionEnd={handlers.onCompositionEnd}
        placeholder="タイトルを入力.."
        aria-label="カードのタイトル"
        aria-expanded={isOpen}
        className={cn(
          "w-full min-h-[54px] text-sm px-2.5 py-2 rounded-lg",
          "border border-border bg-background shadow-sm resize-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "placeholder:text-muted-foreground"
        )}
      />
      <div className="flex gap-2 justify-start">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!title.trim() || isSubmitting}
          aria-label="カードを追加"
        >
          {isSubmitting ? '追加中...' : '追加'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSubmitting}
          aria-label="キャンセル"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}