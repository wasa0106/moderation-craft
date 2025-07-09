/**
 * OfflineDetector - Detects online/offline status
 * Provides utilities for network status monitoring
 */

import { useSyncStore } from '@/stores/sync-store'

export class OfflineDetector {
  private static instance: OfflineDetector
  private listeners: Array<(online: boolean) => void> = []
  private isOnline: boolean = true

  private constructor() {
    this.isOnline = navigator.onLine
    this.setupEventListeners()
  }

  static getInstance(): OfflineDetector {
    if (!OfflineDetector.instance) {
      OfflineDetector.instance = new OfflineDetector()
    }
    return OfflineDetector.instance
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      this.isOnline = true
      this.notifyListeners(true)
    }

    const handleOffline = () => {
      this.isOnline = false
      this.notifyListeners(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Additional check with navigator.connection if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        connection.addEventListener('change', () => {
          const effectiveType = connection.effectiveType
          const isSlowConnection = effectiveType === 'slow-2g' || effectiveType === '2g'
          
          if (isSlowConnection && this.isOnline) {
            this.isOnline = false
            this.notifyListeners(false)
          } else if (!isSlowConnection && !this.isOnline) {
            this.isOnline = true
            this.notifyListeners(true)
          }
        })
      }
    }
  }

  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => listener(online))
  }

  public getStatus(): boolean {
    return this.isOnline
  }

  public addListener(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener)
    
    // Return cleanup function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  public async checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      return false
    }

    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch (error) {
      return false
    }
  }
}

// Hook for React components
export function useOfflineDetector() {
  const setSyncOnlineStatus = useSyncStore(state => state.setOnlineStatus)

  React.useEffect(() => {
    const detector = OfflineDetector.getInstance()
    
    // Set initial status
    setSyncOnlineStatus(detector.getStatus())
    
    // Listen for changes
    const cleanup = detector.addListener((online) => {
      setSyncOnlineStatus(online)
    })

    return cleanup
  }, [setSyncOnlineStatus])

  return {
    isOnline: OfflineDetector.getInstance().getStatus(),
    checkConnectivity: () => OfflineDetector.getInstance().checkConnectivity()
  }
}

import React from 'react'