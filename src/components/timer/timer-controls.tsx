'use client'

import { Button } from '@/components/ui/button'
import { useTimerStore } from '@/stores/timer-store'
import { SmallTask } from '@/types'
import { Play, Square, Brain, Sparkles } from 'lucide-react'

interface TimerControlsProps {
  onStartTimer: (task?: SmallTask, taskDescription?: string) => void
  onStopTimer: () => void
  onMoodClick: () => void
  onDopamineClick: () => void
}

export function TimerControls({
  onStartTimer,
  onStopTimer,
  onMoodClick,
  onDopamineClick,
}: TimerControlsProps) {
  const { isRunning, currentTask, elapsedTime } = useTimerStore()

  const formatElapsedTime = () => {
    const hours = Math.floor(elapsedTime / 3600)
    const minutes = Math.floor((elapsedTime % 3600) / 60)
    const seconds = elapsedTime % 60

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-6">
      {/* タイマー表示 */}
      {isRunning && (
        <div className="text-2xl font-mono font-bold mr-2">
          {formatElapsedTime()}
        </div>
      )}

      {/* タイマーコントロール */}
      {!isRunning ? (
        <Button
          onClick={() => onStartTimer()}
          className="bg-primary hover:bg-primary/90 hover:bg-surface-2 text-primary-foreground gap-2"
          size="sm"
        >
          <Play className="h-4 w-4" />
          開始
        </Button>
      ) : (
        <Button onClick={onStopTimer} variant="destructive" size="sm" className="gap-2 hover:bg-surface-2">
          <Square className="h-4 w-4" />
          停止
        </Button>
      )}

      {/* クイックアクション */}
      <div className="flex items-center gap-1 ml-2 pl-4 border-l border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMoodClick}
          title="感情を記録"
          className="h-8 w-8 hover:bg-surface-2"
        >
          <Brain className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDopamineClick}
          title="ドーパミン記録"
          className="h-8 w-8 hover:bg-surface-2"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}