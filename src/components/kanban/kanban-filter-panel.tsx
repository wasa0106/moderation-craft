'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Filter, 
  RotateCcw, 
  Eye,
  EyeOff,
  Columns
} from 'lucide-react'
import { useKanbanFilterStore } from '@/stores/kanban-filter-store'
import { BigTask, Project } from '@/types'
import { cn } from '@/lib/utils'

interface KanbanFilterPanelProps {
  bigTasks?: BigTask[]
  projects?: Project[]
  allCategories?: string[]
}

export function KanbanFilterPanel({ bigTasks = [], projects = [], allCategories = [] }: KanbanFilterPanelProps) {
  const {
    filters,
    isPanelOpen,
    togglePanel,
    closePanel,
    resetFilters,
    toggleStatus,
    toggleBigTaskSelection,
    selectAllBigTasks,
    clearBigTaskSelection,
    isBigTaskSelected,
    getActiveFilterCount,
    isDefaultFilters
  } = useKanbanFilterStore()

  // アクティブなフィルター数
  const activeFilterCount = getActiveFilterCount()

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift+F: デフォルトフィルターに戻す
      if (e.shiftKey && e.key === 'F') {
        e.preventDefault()
        resetFilters()
      }
      // F: パネル開閉
      else if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        // 入力フィールドにフォーカスがない場合のみ
        const activeElement = document.activeElement
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault()
          togglePanel()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [resetFilters, togglePanel])

  return (
    <>
      {/* アイコンレール形式のフィルターバー */}
      <div className="fixed top-0 right-0 h-full z-50">
        <div 
          className={cn(
            "h-full w-12 bg-zinc-200 dark:bg-zinc-800 border-l border-border flex flex-col items-center pt-4 cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors",
            activeFilterCount > 0 && "border-l-primary"
          )}
          onClick={togglePanel}
        >
          <div className="relative">
            <Filter className={cn(
              "h-5 w-5",
              activeFilterCount > 0 ? "text-primary" : "text-foreground"
            )} />
          </div>
          <span className="sr-only">フィルターを開く</span>
        </div>
      </div>

      {/* フィルターパネル（右端からスライドイン） */}
      <Sheet open={isPanelOpen} modal={false} onOpenChange={togglePanel}>
        <SheetContent 
          className="w-[400px] sm:w-[480px]"
          onInteractOutside={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>フィルター設定</SheetTitle>
            <SheetDescription>
              表示するタスクの条件を設定します
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-6">
            <div className="space-y-6 pr-4">
              {/* ステータスフィルター */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">ステータス</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-active"
                      checked={filters.status.active}
                      onCheckedChange={() => toggleStatus('active')}
                    />
                    <Label htmlFor="status-active" className="text-sm font-normal cursor-pointer">
                      実行中
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-completed"
                      checked={filters.status.completed}
                      onCheckedChange={() => toggleStatus('completed')}
                    />
                    <Label htmlFor="status-completed" className="text-sm font-normal cursor-pointer">
                      完了
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-cancelled"
                      checked={filters.status.cancelled}
                      onCheckedChange={() => toggleStatus('cancelled')}
                    />
                    <Label htmlFor="status-cancelled" className="text-sm font-normal cursor-pointer">
                      キャンセル
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 大タスク表示フィルター */}
              {bigTasks.length > 0 && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Columns className="h-4 w-4" />
                        大タスク表示
                      </Label>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => selectAllBigTasks(bigTasks.map(t => t.id))}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          全選択
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={clearBigTaskSelection}
                        >
                          <EyeOff className="h-3 w-3 mr-1" />
                          全解除
                        </Button>
                      </div>
                    </div>
                    
                    {/* プロジェクトごとにグループ化 */}
                    <div className="space-y-3">
                      {projects.map(project => {
                        const projectBigTasks = bigTasks.filter(bt => bt.project_id === project.id)
                        if (projectBigTasks.length === 0) return null
                        
                        // 「その他」を最後にソート
                        const sortedProjectBigTasks = projectBigTasks.sort((a, b) => {
                          if (a.name === 'その他' && b.name !== 'その他') return 1
                          if (a.name !== 'その他' && b.name === 'その他') return -1
                          return 0
                        })
                        
                        return (
                          <div key={project.id} className="space-y-2">
                            {/* プロジェクトヘッダー */}
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={project.color ? { backgroundColor: project.color } : {}}
                              />
                              <span className="text-xs font-medium text-muted-foreground">
                                {project.name}
                              </span>
                            </div>
                            
                            {/* BigTaskボタングリッド */}
                            <div className="grid grid-cols-2 gap-1">
                              {sortedProjectBigTasks.map(bigTask => {
                                const isSelected = isBigTaskSelected(bigTask.id)
                                return (
                                  <Button
                                    key={bigTask.id}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "justify-start text-xs h-8 px-2 transition-all",
                                      !isSelected && "opacity-40"
                                    )}
                                    style={
                                      project.color
                                        ? {
                                            backgroundColor: isSelected
                                              ? `${project.color}20`
                                              : `${project.color}10`,
                                            borderColor: project.color,
                                            color: project.color
                                          }
                                        : {}
                                    }
                                    onClick={() => toggleBigTaskSelection(bigTask.id)}
                                  >
                                    {isSelected ? (
                                      <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
                                    ) : (
                                      <EyeOff className="h-3 w-3 mr-1 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{bigTask.name}</span>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      
                      {/* プロジェクトに属さないBigTask */}
                      {(() => {
                        const orphanBigTasks = bigTasks.filter(
                          bt => !projects.find(p => p.id === bt.project_id)
                        )
                        if (orphanBigTasks.length === 0) return null
                        
                        return (
                          <div className="space-y-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              その他
                            </span>
                            <div className="grid grid-cols-2 gap-1">
                              {orphanBigTasks.map(bigTask => {
                                const isSelected = isBigTaskSelected(bigTask.id)
                                return (
                                  <Button
                                    key={bigTask.id}
                                    variant={isSelected ? "secondary" : "ghost"}
                                    size="sm"
                                    className={cn(
                                      "justify-start text-xs h-8 px-2",
                                      !isSelected && "opacity-50"
                                    )}
                                    onClick={() => toggleBigTaskSelection(bigTask.id)}
                                  >
                                    {isSelected ? (
                                      <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
                                    ) : (
                                      <EyeOff className="h-3 w-3 mr-1 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{bigTask.name}</span>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  <Separator />
                </>
              )}


              {/* アクションボタン */}
              <div className="space-y-2 pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={resetFilters}
                  disabled={isDefaultFilters()}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  既定に戻す
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={closePanel}
                  >
                    閉じる
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={closePanel}
                  >
                    適用
                  </Button>
                </div>
              </div>

              {/* ショートカットヒント */}
              <div className="text-xs text-muted-foreground space-y-1 pt-4">
                <p>ショートカット:</p>
                <p>• F: パネル開閉</p>
                <p>• Shift+F: 既定に戻す</p>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}