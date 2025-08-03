'use client'

/**
 * TaskMemo - タスク整理メモコンポーネント
 * 手動保存式の週次メモ
 */

import React from 'react'
import { CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskMemoProps {
  value: string
  onChange: (content: string) => void
  onSave: () => void
  isSaving?: boolean
  error?: Error | null
  isDirty?: boolean
}

export function TaskMemo({
  value,
  onChange,
  onSave,
  isSaving = false,
  error = null,
  isDirty = false,
}: TaskMemoProps) {
  // Ctrl+S / Cmd+S でも保存できるように
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (isDirty && !isSaving) {
        onSave()
      }
    }
  }

  return (
    <CardContent className="p-4 bg-surface-0">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">週次計画メモ</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs',
                isDirty && 'text-amber-600',
                isSaving && 'text-muted-foreground',
                !isSaving && !isDirty && !error && 'text-muted-foreground/60',
                error && 'text-destructive'
              )}
            >
              {isDirty && !isSaving && '未保存の変更'}
              {isSaving && '保存中...'}
              {!isSaving && !isDirty && !error && '保存済み'}
              {error && '保存エラー'}
            </span>
            <Button
              size="sm"
              variant={isDirty ? 'default' : 'outline'}
              onClick={onSave}
              disabled={!isDirty || isSaving}
              className="h-8"
            >
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="今週の計画、意識したいこと、目標などを記入してください..."
          className="min-h-[300px] font-mono text-sm bg-surface-1 resize-y"
        />
        <p className="text-xs text-muted-foreground">Ctrl+S (Mac: Cmd+S) でも保存できます</p>
      </div>
    </CardContent>
  )
}
