/**
 * Debug page to test React Query project fetching
 */
'use client'

import { useEffect } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { projectRepository } from '@/lib/db/repositories'
import { Button } from '@/components/ui/button'

export default function DebugProjectsPage() {
  const { projects, isLoading, error, refetch } = useProjects('current-user')

  useEffect(() => {
    console.log('=== Debug Projects Page ===')
    console.log('React Query - projects:', projects)
    console.log('React Query - isLoading:', isLoading)
    console.log('React Query - error:', error)
  }, [projects, isLoading, error])

  const checkDirectly = async () => {
    const directProjects = await projectRepository.getByUserId('current-user')
    console.log('Direct IndexedDB projects:', directProjects)
    console.log('Comparison:', {
      directLength: directProjects.length,
      reactQueryLength: projects.length,
      areEqual: directProjects.length === projects.length
    })
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Projects</h1>
      
      <div className="space-y-4">
        <div>
          <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
          <p>Error: {error ? error.message : 'None'}</p>
          <p>Projects count: {projects.length}</p>
        </div>

        <div className="space-x-2">
          <Button onClick={() => refetch()}>Refetch</Button>
          <Button onClick={checkDirectly} variant="outline">Check IndexedDB Directly</Button>
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">Projects:</h2>
          {projects.length === 0 ? (
            <p className="text-muted-foreground">No projects found</p>
          ) : (
            <ul className="space-y-2">
              {projects.map(project => (
                <li key={project.id} className="p-2 bg-muted rounded">
                  {project.name} - {project.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}