import { useState, KeyboardEvent, CompositionEvent, useCallback } from 'react'

interface UseImeAwareInputOptions {
  onSubmit: () => void | Promise<void>
  onCancel?: () => void
}

interface UseImeAwareInputReturn {
  isComposing: boolean
  handlers: {
    onCompositionStart: (e: CompositionEvent<HTMLTextAreaElement>) => void
    onCompositionEnd: (e: CompositionEvent<HTMLTextAreaElement>) => void
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  }
}

/**
 * 日本語IME対応のテキスト入力カスタムフック
 * 
 * Trello風の入力挙動を実現:
 * - Enter: IME変換中でなければ送信
 * - Shift+Enter: 改行
 * - Escape: キャンセル
 */
export function useImeAwareInput({
  onSubmit,
  onCancel,
}: UseImeAwareInputOptions): UseImeAwareInputReturn {
  const [isComposing, setIsComposing] = useState(false)

  const handleCompositionStart = useCallback((e: CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(true)
  }, [])

  const handleCompositionEnd = useCallback((e: CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter: 改行（デフォルト動作を許可）
    if (e.key === 'Enter' && e.shiftKey) {
      return // 改行を許可
    }

    // Enter（IME変換中でない場合）: 送信
    if (e.key === 'Enter' && !e.shiftKey) {
      // IME変換中またはe.isComposingがtrueの場合は送信しない
      if (isComposing || e.nativeEvent.isComposing) {
        return // 変換中は何もしない
      }
      
      e.preventDefault()
      onSubmit()
    }

    // Escape: キャンセル
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel?.()
    }
  }, [isComposing, onSubmit, onCancel])

  return {
    isComposing,
    handlers: {
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
      onKeyDown: handleKeyDown,
    },
  }
}