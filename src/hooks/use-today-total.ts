/**
 * useTodayTotal - Hook for getting today's work time total with real-time updates
 */

import { useState, useEffect, useCallback } from 'react'
import { workSessionRepository } from '@/lib/db/repositories'
import { useTimerStore } from '@/stores/timer-store'
import { format } from 'date-fns'
import { WorkSession } from '@/types'
import { formatSecondsToHoursMinutes } from '@/lib/utils/time-utils'

export function useTodayTotal(userId: string, sessions: WorkSession[]) {
  const [todayTotalSeconds, setTodayTotalSeconds] = useState(0)
  const [baseTodaySeconds, setBaseTodaySeconds] = useState(0)
  const { isRunning, startTime } = useTimerStore()
  
  // 今日の合計時間を計算（秒単位）
  const calculateTotalSeconds = useCallback(() => {
    return sessions.reduce((sum, session) => sum + session.duration_seconds, 0)
  }, [sessions])
  
  // セッションが変更されたときに基準時間を更新
  useEffect(() => {
    const totalSeconds = calculateTotalSeconds()
    setBaseTodaySeconds(totalSeconds)
    setTodayTotalSeconds(totalSeconds)
  }, [sessions, calculateTotalSeconds])
  
  // タイマー実行中のリアルタイム更新
  useEffect(() => {
    if (!isRunning || !startTime) return
    
    const interval = setInterval(() => {
      // 現在のセッション時間を計算（秒単位）
      const currentSessionSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000)
      
      // 基準時間（秒）に現在のセッション時間（秒）を加算して表示
      setTodayTotalSeconds(baseTodaySeconds + currentSessionSeconds)
    }, 1000) // 1秒ごとに更新
    
    return () => clearInterval(interval)
  }, [isRunning, startTime, baseTodaySeconds])
  
  // タイマー停止時の処理
  useEffect(() => {
    if (isRunning === false && startTime) {
      // タイマーが停止したら、セッションデータから最新の合計を再計算
      const totalSeconds = calculateTotalSeconds()
      setTodayTotalSeconds(totalSeconds)
      setBaseTodaySeconds(totalSeconds)
    }
  }, [isRunning, calculateTotalSeconds, startTime])
  
  return {
    todayTotalSeconds,
    todayTotalFormatted: formatSecondsToHoursMinutes(todayTotalSeconds),
  }
}