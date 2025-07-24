/**
 * TaskMemo - タスク整理メモコンポーネント
 * 常に編集モードで表示
 */

import { useEffect } from 'react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { FileText } from 'lucide-react'

interface TaskMemoProps {
  value: string
  onChange: (content: string) => void
  className?: string
}

export function TaskMemo({ value, onChange, className }: TaskMemoProps) {
  // 自動保存（デバウンス付き）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && value) {
        localStorage.setItem('weeklyScheduleMemo', value)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [value])

  return (
    <>
      <CardHeader className="px-6 py-4 border-b border-[#C9C7B6]">
        <CardTitle className="text-lg font-semibold text-[#1C1C14] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#864E41]" />
          タスク整理メモ
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="メモを入力してください..."
          className="min-h-[300px] font-mono text-sm bg-[#FCFAEC] border-[#D4D2C1] focus:border-[#5F6044] resize-y"
        />
      </CardContent>
    </>
  )
}