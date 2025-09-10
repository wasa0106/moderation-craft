/**
 * ProjectsPage - プロジェクト一覧ページ
 * プロジェクト管理のメインページ
 */

'use client'

import { ProjectList } from '@/components/project/project-list'
import { useProjects } from '@/hooks/use-projects'
import { DatabaseError } from '@/components/error/database-error'
import { useRouter } from 'next/navigation'
import { Project } from '@/types'

export default function ProjectsPage() {
  const router = useRouter()
  const { projects, isLoading, error, deleteProject, refetch } = useProjects('current-user')

  const handleCreateProject = () => {
    // Navigation will be handled by Link component
  }

  const handleEditProject = () => {
    // Navigation will be handled by Link component
  }

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId)
  }

  const handleViewTasks = (project: Project) => {
    // プロジェクト詳細ページへ遷移
    router.push(`/projects/${project.id}`)
  }

  // Calculate project statistics
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    overdue: projects.filter(
      p => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'completed'
    ).length,
  }

  // データベースエラーの場合は専用コンポーネントを表示
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <DatabaseError error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col p-6 md:p-8 max-w-7xl mx-auto w-full">
      <ProjectList
        projects={projects}
        onCreateProject={handleCreateProject}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        onViewTasks={handleViewTasks}
        isLoading={isLoading}
      />
    </div>
  )
}
