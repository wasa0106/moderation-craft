/**
 * useSmallTasks - Small tasks management hook
 * Provides CRUD operations for small tasks with optimistic updates
 */

import { useState, useEffect } from 'react'
import { SmallTask, CreateSmallTaskData, UpdateSmallTaskData } from '@/types'

export function useSmallTasks(projectId?: string) {
  const [smallTasks, setSmallTasks] = useState<SmallTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Mock data for development
  useEffect(() => {
    // Initialize with empty array for now
    setSmallTasks([])
  }, [projectId])

  const createSmallTask = async (data: CreateSmallTaskData): Promise<SmallTask> => {
    setIsLoading(true)
    try {
      // Mock creation
      const newSmallTask = {
        ...data,
        id: `small-task-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        actual_minutes: 0
      } as SmallTask
      setSmallTasks(prev => [...prev, newSmallTask])
      return newSmallTask
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateSmallTask = async (id: string, data: UpdateSmallTaskData): Promise<SmallTask> => {
    setIsLoading(true)
    try {
      // Mock update
      const updatedSmallTask = smallTasks.find(task => task.id === id)
      if (!updatedSmallTask) throw new Error('Small task not found')
      
      const updated = { ...updatedSmallTask, ...data, updated_at: new Date().toISOString() }
      setSmallTasks(prev => prev.map(task => task.id === id ? updated : task))
      return updated
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSmallTask = async (id: string): Promise<void> => {
    setIsLoading(true)
    try {
      // Mock deletion
      setSmallTasks(prev => prev.filter(task => task.id !== id))
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    smallTasks,
    isLoading,
    error,
    createSmallTask,
    updateSmallTask,
    deleteSmallTask,
    isCreating: isLoading,
    isUpdating: isLoading,
    isDeleting: isLoading
  }
}