/**
 * AutoSaveIndicator - 自動保存状態を表示するコンポーネント
 */

'use client'

import { useEffect, useState } from 'react'
import { Check, Save, AlertCircle } from 'lucide-react'

interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved?: Date
  error?: string
}

export function AutoSaveIndicator({ status, lastSaved, error }: AutoSaveIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (status !== 'idle') {
      setIsVisible(true)

      if (status === 'saved' || status === 'error') {
        const timer = setTimeout(() => setIsVisible(false), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [status])

  if (!isVisible) return null

  const getIcon = () => {
    switch (status) {
      case 'saving':
        return <Save className="h-4 w-4 animate-spin" />
      case 'saved':
        return <Check className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getMessage = () => {
    switch (status) {
      case 'saving':
        return '保存中...'
      case 'saved':
        return lastSaved ? `保存済み (${lastSaved.toLocaleTimeString()})` : '保存済み'
      case 'error':
        return error || '保存エラー'
      default:
        return ''
    }
  }

  const getClassName = () => {
    const baseClass = 'auto-save-indicator flex items-center gap-2'
    switch (status) {
      case 'saving':
        return `${baseClass} bg-yellow-100 text-yellow-800`
      case 'saved':
        return `${baseClass} bg-green-100 text-green-800`
      case 'error':
        return `${baseClass} bg-red-100 text-red-800`
      default:
        return baseClass
    }
  }

  return (
    <div className={getClassName()}>
      {getIcon()}
      <span>{getMessage()}</span>
    </div>
  )
}
