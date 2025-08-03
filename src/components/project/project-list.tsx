/**
 * ProjectList - Displays a list of projects with filtering and sorting
 * Supports different view modes and actions
 */

'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ProjectCard } from './project-card'
import { ProjectDeleteDialog } from './project-delete-dialog'
import { Search, Plus, Grid, List } from 'lucide-react'
import { Project } from '@/types'
import { cn } from '@/lib/utils'

interface ProjectListProps {
  projects: Project[]
  onCreateProject?: () => void
  onEditProject?: (project: Project) => void
  onDeleteProject?: (projectId: string) => void
  onDuplicateProject?: (projectId: string) => void
  onViewTasks?: (project: Project) => void
  isLoading?: boolean
  className?: string
}

type SortField = 'name' | 'created_at' | 'deadline' | 'status'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'grid' | 'list'

export function ProjectList({
  projects,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onDuplicateProject,
  onViewTasks,
  isLoading = false,
  className,
}: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        project =>
          project.name.toLowerCase().includes(query) || project.goal.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aValue: string | Date = a[sortField]
      let bValue: string | Date = b[sortField]

      if (sortField === 'created_at' || sortField === 'deadline') {
        aValue = new Date(aValue || 0)
        bValue = new Date(bValue || 0)
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [projects, searchQuery, statusFilter, sortField, sortDirection])

  // Paginated projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredProjects.slice(startIndex, endIndex)
  }, [filteredProjects, currentPage])

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, sortField, sortDirection])

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project)
  }

  const confirmDeleteProject = () => {
    if (projectToDelete && onDeleteProject) {
      onDeleteProject(projectToDelete.id)
    }
    setProjectToDelete(null)
  }

  const getStatusCounts = () => {
    const counts = {
      all: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
    }
    return counts
  }

  const statusCounts = getStatusCounts()

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">プロジェクト一覧</h2>
          <p className="text-muted-foreground">
            {filteredProjects.length} / {projects.length} プロジェクト
          </p>
        </div>
        {onCreateProject && (
          <Button onClick={onCreateProject} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新しいプロジェクト
          </Button>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setStatusFilter('all')}
        >
          すべて ({statusCounts.all})
        </Badge>
        <Badge
          variant={statusFilter === 'active' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setStatusFilter('active')}
        >
          アクティブ ({statusCounts.active})
        </Badge>
        <Badge
          variant={statusFilter === 'completed' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setStatusFilter('completed')}
        >
          完了 ({statusCounts.completed})
        </Badge>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="プロジェクトを検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={`${sortField}-${sortDirection}`}
            onValueChange={value => {
              const [field, direction] = value.split('-')
              setSortField(field as SortField)
              setSortDirection(direction as SortDirection)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="並び替え" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">名前 (A-Z)</SelectItem>
              <SelectItem value="name-desc">名前 (Z-A)</SelectItem>
              <SelectItem value="created_at-desc">作成日 (新しい順)</SelectItem>
              <SelectItem value="created_at-asc">作成日 (古い順)</SelectItem>
              <SelectItem value="deadline-asc">期限 (近い順)</SelectItem>
              <SelectItem value="deadline-desc">期限 (遠い順)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Projects grid/list */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {projects.length === 0
              ? 'プロジェクトがありません。新しいプロジェクトを作成してください。'
              : '検索条件に一致するプロジェクトが見つかりません。'}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-4'
          )}
        >
          {paginatedProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={onEditProject}
              onDelete={handleDeleteProject}
              onDuplicate={onDuplicateProject ? () => onDuplicateProject(project.id) : undefined}
              onViewTasks={onViewTasks}
              className={viewMode === 'list' ? 'max-w-none' : ''}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={e => {
                    e.preventDefault()
                    setCurrentPage(prev => Math.max(1, prev - 1))
                  }}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>

              {/* First page */}
              <PaginationItem>
                <PaginationLink
                  href="#"
                  onClick={e => {
                    e.preventDefault()
                    setCurrentPage(1)
                  }}
                  isActive={currentPage === 1}
                >
                  1
                </PaginationLink>
              </PaginationItem>

              {/* Ellipsis if needed */}
              {currentPage > 3 && totalPages > 4 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {/* Middle pages */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  if (page === 1 || page === totalPages) return false
                  if (page >= currentPage - 1 && page <= currentPage + 1) return true
                  return false
                })
                .map(page => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={e => {
                        e.preventDefault()
                        setCurrentPage(page)
                      }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

              {/* Ellipsis if needed */}
              {currentPage < totalPages - 2 && totalPages > 4 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {/* Last page */}
              {totalPages > 1 && (
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={e => {
                      e.preventDefault()
                      setCurrentPage(totalPages)
                    }}
                    isActive={currentPage === totalPages}
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={e => {
                    e.preventDefault()
                    setCurrentPage(prev => Math.min(totalPages, prev + 1))
                  }}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ProjectDeleteDialog
        project={projectToDelete}
        open={!!projectToDelete}
        onOpenChange={open => !open && setProjectToDelete(null)}
        onConfirm={confirmDeleteProject}
      />
    </div>
  )
}
