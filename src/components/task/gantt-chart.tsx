/**
 * GanttChart - Gantt chart component for visualizing task timeline
 * Placeholder component for future implementation
 */

'use client'

import { BigTask } from '@/types'
import { BarChart3 } from 'lucide-react'

interface GanttChartProps {
  bigTasks: BigTask[]
}

export function GanttChart({ bigTasks }: GanttChartProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <BarChart3 className="h-16 w-16 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">
        ガントチャート
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        タスクのタイムラインを視覚的に表示するガントチャート機能は、
        今後実装予定です。
      </p>
      {bigTasks.length > 0 && (
        <p className="text-sm text-muted-foreground mt-4">
          現在 {bigTasks.length} 件のタスクが登録されています
        </p>
      )}
    </div>
  )
}