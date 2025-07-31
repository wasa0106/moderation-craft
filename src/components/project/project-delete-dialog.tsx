/**
 * ProjectDeleteDialog - Confirmation dialog for deleting projects
 * Shows project information and confirms deletion
 */

'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Project } from '@/types'
import { AlertTriangle } from 'lucide-react'

interface ProjectDeleteDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ProjectDeleteDialog({
  project,
  open,
  onOpenChange,
  onConfirm,
}: ProjectDeleteDialogProps) {
  if (!project) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            プロジェクトを削除
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>以下のプロジェクトを削除しますか？この操作は取り消せません。</p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium">{project.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{project.goal}</p>
            </div>
            <p className="text-sm text-destructive font-medium">
              ⚠️ このプロジェクトに関連するすべてのタスクとセッションも削除されます。
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
          >
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
