/**
 * ProjectsPage - プロジェクト一覧ページ
 * プロジェクト管理のメインページ
 */

'use client'

import { ProjectList } from '@/components/project/project-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjects } from '@/hooks/use-projects'
import { DatabaseError } from '@/components/error/database-error'
import { Plus, FolderOpen, Target, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">プロジェクト管理</h1>
          <p className="text-gray-600 mt-2">プロジェクトを作成・管理して目標を達成しましょう</p>
        </div>
        <Link href="/projects/new">
          <Button size="lg" className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            新しいプロジェクト
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">総プロジェクト数</CardTitle>
            <FolderOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">アクティブ</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">完了済み</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">期限超過</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Project List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            プロジェクト一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectList
            projects={projects}
            onCreateProject={handleCreateProject}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onViewTasks={handleViewTasks}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {projects.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">プロジェクトがありません</h3>
            <p className="text-gray-600 mb-6">
              最初のプロジェクトを作成して、目標達成への第一歩を踏み出しましょう
            </p>
            <Link href="/projects/new">
              <Button size="lg">
                <Plus className="h-5 w-5 mr-2" />
                プロジェクトを作成
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
