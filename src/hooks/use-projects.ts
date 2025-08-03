/**
 * useProjects - Custom hook for project operations with optimistic updates
 * Handles project CRUD operations with TanStack Query and Zustand
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectRepository } from '@/lib/db/repositories'
import { useProjectStore } from '@/stores/project-store'
import { SyncService } from '@/lib/sync/sync-service'
import { queryKeys, invalidateQueries } from '@/lib/query/query-client'
import { Project, CreateProjectData, UpdateProjectData } from '@/types'
import { generateId } from '@/lib/utils'
import { db } from '@/lib/db/database'

const syncService = SyncService.getInstance()

export function useProjects(userId: string) {
  const queryClient = useQueryClient()
  const projectStore = useProjectStore()

  // Fetch projects query
  const projectsQuery = useQuery({
    queryKey: queryKeys.projectsByUser(userId),
    queryFn: async () => {
      console.log('useProjects queryFn called with userId:', userId)
      console.log('Query key:', queryKeys.projectsByUser(userId))

      try {
        const projects = await projectRepository.getByUserId(userId)
        console.log('Projects fetched from repository:', projects)
        projectStore.setProjects(projects)
        return projects
      } catch (error) {
        console.error('Failed to get projects by user ID:', error)

        // データベースエラーの場合は復旧を試行
        if (
          error instanceof Error &&
          (error.message.includes('UpgradeError') ||
            error.message.includes('DatabaseClosedError') ||
            error.message.includes('primary key'))
        ) {
          console.warn('Database schema error detected, attempting recovery...')
          try {
            await db.handleSchemaError()
            // 復旧後に再試行
            const projects = await projectRepository.getByUserId(userId)
            projectStore.setProjects(projects)
            return projects
          } catch (recoveryError) {
            console.error('Database recovery failed:', recoveryError)
            throw new Error('データベースの復旧に失敗しました。ページをリロードしてください。')
          }
        }

        throw error
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
    retry: (failureCount, error) => {
      // データベースエラーの場合は自動リトライしない
      if (
        error instanceof Error &&
        (error.message.includes('UpgradeError') ||
          error.message.includes('DatabaseClosedError') ||
          error.message.includes('primary key'))
      ) {
        return false
      }
      return failureCount < 3
    },
  })

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: CreateProjectData) => {
      const createdProject = await projectRepository.create(data)
      await syncService.addToSyncQueue('project', createdProject.id, 'create', createdProject)
      return createdProject
    },
    onSuccess: project => {
      invalidateQueries.projectsByUser(userId)
      invalidateQueries.projects()
    },
    onError: error => {
      console.error('Failed to create project:', error)
      projectStore.setError(error instanceof Error ? error.message : 'Failed to create project')
    },
  })

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectData }) => {
      const originalProject = projectStore.getProjectById(id)
      if (!originalProject) {
        throw new Error('Project not found')
      }

      const updatedProject = {
        ...originalProject,
        ...data,
        updated_at: new Date().toISOString(),
      }

      // Optimistic update
      projectStore.optimisticUpdate(id, updatedProject)

      try {
        const result = await projectRepository.update(id, data)
        await syncService.addToSyncQueue('project', id, 'update', result)
        return result
      } catch (error) {
        // Revert optimistic update on error
        projectStore.revertOptimisticUpdate(id, originalProject)
        throw error
      }
    },
    onSuccess: project => {
      invalidateQueries.project(project.id)
      invalidateQueries.projectsByUser(userId)
    },
    onError: error => {
      console.error('Failed to update project:', error)
      projectStore.setError(error instanceof Error ? error.message : 'Failed to update project')
    },
  })

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const originalProject = projectStore.getProjectById(id)
      if (!originalProject) {
        throw new Error('Project not found')
      }

      // Optimistic update
      projectStore.optimisticDelete(id)

      try {
        await projectRepository.delete(id)
        await syncService.addToSyncQueue('project', id, 'delete')
      } catch (error) {
        // Revert optimistic update on error
        projectStore.revertOptimisticDelete(originalProject)
        throw error
      }
    },
    onSuccess: (_, deletedId) => {
      invalidateQueries.project(deletedId)
      invalidateQueries.projectsByUser(userId)
    },
    onError: error => {
      console.error('Failed to delete project:', error)
      projectStore.setError(error instanceof Error ? error.message : 'Failed to delete project')
    },
  })

  // Duplicate project mutation
  const duplicateProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const originalProject = await projectRepository.getById(id)
      if (!originalProject) {
        throw new Error('Project not found')
      }

      const duplicateData: CreateProjectData = {
        user_id: originalProject.user_id,
        name: `${originalProject.name} (Copy)`,
        goal: originalProject.goal,
        deadline: originalProject.deadline,
        status: 'active',
        version: 1,
      }

      return createProjectMutation.mutateAsync(duplicateData)
    },
  })

  return {
    // Query state
    projects: projectsQuery.data || [],
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,

    // Store state
    activeProject: projectStore.getActiveProject(),
    activeProjects: projectStore.getActiveProjects(),
    completedProjects: projectStore.getCompletedProjects(),

    // Mutations
    createProject: createProjectMutation.mutateAsync,
    updateProject: updateProjectMutation.mutateAsync,
    deleteProject: deleteProjectMutation.mutateAsync,
    duplicateProject: duplicateProjectMutation.mutateAsync,

    // Mutation states
    isCreating: createProjectMutation.isPending,
    isUpdating: updateProjectMutation.isPending,
    isDeleting: deleteProjectMutation.isPending,
    isDuplicating: duplicateProjectMutation.isPending,

    // Store actions
    setActiveProject: projectStore.setActiveProject,
    clearError: () => projectStore.setError(null),

    // Utility functions
    getProjectById: projectStore.getProjectById,
    getProjectsByStatus: projectStore.getProjectsByStatus,

    // Refresh data
    refetch: projectsQuery.refetch,
  }
}

export function useProject(projectId: string) {
  const queryClient = useQueryClient()
  const projectStore = useProjectStore()

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: async () => {
      const project = await projectRepository.getById(projectId)
      return project
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    isLoading: projectQuery.isLoading,
    error: projectQuery.error,
    refetch: projectQuery.refetch,
  }
}

export function useActiveProjects(userId: string) {
  const projectStore = useProjectStore()

  const activeProjectsQuery = useQuery({
    queryKey: queryKeys.activeProjects(userId),
    queryFn: async () => {
      const projects = await projectRepository.getActiveProjects(userId)
      return projects
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!userId,
  })

  return {
    activeProjects: activeProjectsQuery.data || [],
    isLoading: activeProjectsQuery.isLoading,
    error: activeProjectsQuery.error,
    refetch: activeProjectsQuery.refetch,
  }
}
