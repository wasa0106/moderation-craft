/**
 * useWeeklyTotal - Hook for getting weekly work time total with real-time updates
 */

import { useState, useEffect, useCallback } from 'react'
import { workSessionRepository } from '@/lib/db/repositories'
import { useTimerStore } from '@/stores/timer-store'
import { formatSecondsToTime } from '@/lib/utils/time-utils'

export function useWeeklyTotal(userId: string, date: Date = new Date()) {
  const [weeklyTotalSeconds, setWeeklyTotalSeconds] = useState(0)
  const [baseWeeklySeconds, setBaseWeeklySeconds] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const { isRunning, startTime } = useTimerStore()

  // 週の合計時間を取得
  const loadWeeklyTotal = useCallback(async () => {
    try {
      setIsLoading(true)
      const totalSeconds = await workSessionRepository.getWeeklyTotalSeconds(userId, date)
      setWeeklyTotalSeconds(totalSeconds)
      setBaseWeeklySeconds(totalSeconds)
    } catch (error) {
      console.error('Failed to load weekly total:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, date])

  // 初期読み込みとタイマー状態変更時の更新
  useEffect(() => {
    loadWeeklyTotal()
  }, [loadWeeklyTotal, isRunning])

  // タイマー実行中のリアルタイム更新
  useEffect(() => {
    if (!isRunning || !startTime) return

    const interval = setInterval(() => {
      // 現在のセッション時間を計算（秒単位）
      const currentSessionSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000)

      // baseWeeklySecondsに現在のセッション時間を加算
      setWeeklyTotalSeconds(baseWeeklySeconds + currentSessionSeconds)
    }, 1000) // 1秒ごとに更新

    return () => clearInterval(interval)
  }, [isRunning, startTime, baseWeeklySeconds])

  return {
    weeklyTotalSeconds,
    weeklyTotalFormatted: formatSecondsToTime(weeklyTotalSeconds),
    isLoading,
    refresh: loadWeeklyTotal,
  }
}
