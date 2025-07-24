/**
 * FocusDialog - 集中力入力ダイアログ
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
import { Label } from '@/components/ui/label'
import { Brain, Target, Zap, Coffee, Wind, Cloud, Flame, Star, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FocusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (focusLevel: number) => void
}

const focusLevels = [
  { value: 1, icon: Moon, label: '眠い', color: 'text-gray-500' },
  { value: 2, icon: Cloud, label: 'ぼんやり', color: 'text-gray-600' },
  { value: 3, icon: Coffee, label: '疲れ気味', color: 'text-amber-600' },
  { value: 4, icon: Wind, label: '普通', color: 'text-blue-500' },
  { value: 5, icon: Target, label: 'まあまあ', color: 'text-blue-600' },
  { value: 6, icon: Brain, label: '集中', color: 'text-purple-500' },
  { value: 7, icon: Flame, label: 'かなり集中', color: 'text-orange-600' },
  { value: 8, icon: Star, label: '深い集中', color: 'text-yellow-600' },
  { value: 9, icon: Zap, label: 'ゾーン！', color: 'text-purple-700' },
]

export function FocusDialog({ open, onOpenChange, onSubmit }: FocusDialogProps) {
  const [selectedFocus, setSelectedFocus] = useState<number | null>(null)

  const handleSubmit = () => {
    if (!selectedFocus) return
    onSubmit(selectedFocus)
    setSelectedFocus(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>集中力レベルを記録</DialogTitle>
          <DialogDescription>
            作業中の集中度を9段階で評価してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>集中力レベル</Label>
            <div className="grid grid-cols-3 gap-3">
              {focusLevels.map(level => {
                const Icon = level.icon
                const isSelected = selectedFocus === level.value
                
                return (
                  <button
                    key={level.value}
                    onClick={() => setSelectedFocus(level.value)}
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
                    <span className={cn(
                      'text-lg font-bold',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {level.value}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedFocus && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-center">
                選択した集中力レベル: <span className="font-bold text-lg">{selectedFocus}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedFocus}
          >
            記録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}