/**
 * Debug Provider - Loads debug utilities in development mode
 */

'use client'

import { useEffect } from 'react'

export function DebugProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // デバッグユーティリティの動的インポートを一時的に無効化
      console.log('🔧 Debug Provider: Temporarily disabled due to dynamic import issues')
      console.log('📋 Use QUICK_DEBUG_SCRIPTS.md for debugging')
      console.log('💡 Copy and paste scripts directly into browser console')
    }
  }, [])

  return <>{children}</>
}
