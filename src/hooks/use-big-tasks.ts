/**
 * useBigTasks - Big tasks management hook
 * Provides CRUD operations for big tasks with optimistic updates
 */

import { useState, useEffect } from 'react'
import { BigTask, CreateBigTaskData, UpdateBigTaskData } from '@/types'

export function useBigTasks(projectId?: string) {
  const [bigTasks, setBigTasks] = useState<BigTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Mock data for development
  useEffect(() => {
    // Initialize with empty array for now
    setBigTasks([])
  }, [projectId])

  const createBigTask = async (data: CreateBigTaskData): Promise<BigTask> => {
    setIsLoading(true)
    try {
      // Mock creation
      const newBigTask = {
        ...data,
        id: `big-task-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending' as const,
        actual_hours: undefined
      } as BigTask
      setBigTasks(prev => [...prev, newBigTask])
      return newBigTask
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateBigTask = async (id: string, data: UpdateBigTaskData): Promise<BigTask> => {
    setIsLoading(true)
    try {
      // Mock update
      const updatedBigTask = bigTasks.find(task => task.id === id)
      if (!updatedBigTask) throw new Error('Big task not found')
      
      const updated = { ...updatedBigTask, ...data, updated_at: new Date().toISOString() }
      setBigTasks(prev => prev.map(task => task.id === id ? updated : task))
      return updated
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deleteBigTask = async (id: string): Promise<void> => {
    setIsLoading(true)
    try {
      // Mock deletion
      setBigTasks(prev => prev.filter(task => task.id !== id))
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    bigTasks,
    isLoading,
    error,
    createBigTask,
    updateBigTask,
    deleteBigTask,
    isCreating: isLoading,
    isUpdating: isLoading,
    isDeleting: isLoading
  }
}