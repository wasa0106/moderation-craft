/**
 * ProjectStore - Zustand store for project state management
 * Handles project creation, updates, and optimistic updates
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Project, CreateProjectData, UpdateProjectData } from '@/types'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setProjects: (projects: Project[]) => void
  setActiveProject: (projectId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Optimistic updates
  optimisticCreate: (project: Project) => void
  optimisticUpdate: (projectId: string, updates: Partial<Project>) => void
  optimisticDelete: (projectId: string) => void

  // Revert optimistic updates
  revertOptimisticCreate: (projectId: string) => void
  revertOptimisticUpdate: (projectId: string, originalProject: Project) => void
  revertOptimisticDelete: (project: Project) => void

  // Selectors
  getActiveProject: () => Project | null
  getProjectById: (id: string) => Project | null
  getActiveProjects: () => Project[]
  getCompletedProjects: () => Project[]
  getProjectsByStatus: (status: Project['status']) => Project[]
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      isLoading: false,
      error: null,

      setProjects: projects => set({ projects }),
      setActiveProject: projectId => set({ activeProjectId: projectId }),
      setLoading: loading => set({ isLoading: loading }),
      setError: error => set({ error }),

      optimisticCreate: project =>
        set(state => ({
          projects: [...state.projects, project],
          error: null,
        })),

      optimisticUpdate: (projectId, updates) =>
        set(state => ({
          projects: state.projects.map(p => (p.id === projectId ? { ...p, ...updates } : p)),
          error: null,
        })),

      optimisticDelete: projectId =>
        set(state => ({
          projects: state.projects.filter(p => p.id !== projectId),
          activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
          error: null,
        })),

      revertOptimisticCreate: projectId =>
        set(state => ({
          projects: state.projects.filter(p => p.id !== projectId),
        })),

      revertOptimisticUpdate: (projectId, originalProject) =>
        set(state => ({
          projects: state.projects.map(p => (p.id === projectId ? originalProject : p)),
        })),

      revertOptimisticDelete: project =>
        set(state => ({
          projects: [...state.projects, project],
        })),

      getActiveProject: () => {
        const { projects, activeProjectId } = get()
        return activeProjectId ? projects.find(p => p.id === activeProjectId) || null : null
      },

      getProjectById: id => {
        const { projects } = get()
        return projects.find(p => p.id === id) || null
      },

      getActiveProjects: () => {
        const { projects } = get()
        return projects.filter(p => p.status === 'active')
      },

      getCompletedProjects: () => {
        const { projects } = get()
        return projects.filter(p => p.status === 'completed')
      },

      getProjectsByStatus: status => {
        const { projects } = get()
        return projects.filter(p => p.status === status)
      },
    }),
    {
      name: 'project-store',
      serialize: {
        options: {
          map: true,
        },
      },
    }
  )
)
