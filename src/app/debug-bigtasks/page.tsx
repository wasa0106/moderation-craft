/**
 * BigTasksのデバッグページ
 */
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { bigTaskRepository, projectRepository } from '@/lib/db/repositories'
import { Project, BigTask } from '@/types'
import { useBigTasks } from '@/hooks/use-big-tasks'

export default function DebugBigTasksPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [directBigTasks, setDirectBigTasks] = useState<BigTask[]>([])
  
  // React Query経由でBigTasksを取得
  const { bigTasks, isLoading, error, refetch } = useBigTasks('current-user', selectedProjectId)

  // プロジェクト一覧を取得
  useEffect(() => {
    const loadProjects = async () => {
      const projectList = await projectRepository.getByUserId('current-user')
      console.log('取得したプロジェクト:', projectList)
      setProjects(projectList)
      if (projectList.length > 0) {
        setSelectedProjectId(projectList[0].id)
      }
    }
    loadProjects()
  }, [])

  // 選択されたプロジェクトのBigTasksを直接取得
  useEffect(() => {
    if (selectedProjectId) {
      const loadDirectBigTasks = async () => {
        const tasks = await bigTaskRepository.getByProjectId(selectedProjectId)
        console.log('IndexedDBから直接取得したBigTasks:', tasks)
        setDirectBigTasks(tasks)
      }
      loadDirectBigTasks()
    }
  }, [selectedProjectId])

  // デバッグ情報を表示
  useEffect(() => {
    console.log('=== BigTasks Debug Info ===')
    console.log('Selected Project ID:', selectedProjectId)
    console.log('React Query BigTasks:', bigTasks)
    console.log('Direct BigTasks:', directBigTasks)
    console.log('Loading:', isLoading)
    console.log('Error:', error)
  }, [selectedProjectId, bigTasks, directBigTasks, isLoading, error])

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">BigTasks デバッグ</h1>
      
      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">プロジェクト選択</h2>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">プロジェクトを選択</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">React Query 経由</h2>
          <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
          <p>Error: {error ? error.message : 'None'}</p>
          <p>BigTasks count: {bigTasks.length}</p>
          <Button onClick={() => refetch()} className="mt-2">再取得</Button>
          
          {bigTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              {bigTasks.map(task => (
                <div key={task.id} className="p-2 bg-gray-100 rounded">
                  <p className="font-medium">{task.name}</p>
                  <p className="text-sm text-gray-600">
                    Week {task.week_number} | {task.category} | {task.estimated_hours}h
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">IndexedDB 直接</h2>
          <p>BigTasks count: {directBigTasks.length}</p>
          
          {directBigTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              {directBigTasks.map(task => (
                <div key={task.id} className="p-2 bg-blue-100 rounded">
                  <p className="font-medium">{task.name}</p>
                  <p className="text-sm text-gray-600">
                    Week {task.week_number} | {task.category} | {task.estimated_hours}h
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}