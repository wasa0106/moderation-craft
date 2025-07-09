/**
 * ProjectCreatePage - プロジェクト作成ページ
 * 新しいプロジェクトを作成するためのページ
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectForm } from '@/components/project/project-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjects } from '@/hooks/use-projects'
import { CreateProjectData } from '@/types'
import { ArrowLeft, FolderPlus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ProjectCreatePage() {
  const router = useRouter()
  const { createProject } = useProjects('current-user')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: CreateProjectData) => {
    setIsSubmitting(true)
    
    try {
      createProject(data)
      
      // Success toast
      toast.success('プロジェクトが正常に作成されました')
      
      // Navigate to projects list
      router.push('/projects')
      
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('プロジェクトの作成に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push('/projects')
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              プロジェクト一覧に戻る
            </Button>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FolderPlus className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">新しいプロジェクト</h1>
            <p className="text-gray-600 mt-1">目標を設定して、新しいプロジェクトを開始しましょう</p>
          </div>
        </div>
      </div>

      {/* Project Creation Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              プロジェクト情報
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={isSubmitting}
            />
          </CardContent>
        </Card>

        {/* Tips Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">プロジェクト作成のヒント</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 明確で具体的な目標を設定することが成功の鍵です</li>
                  <li>• 期限を設定することで、モチベーションを維持できます</li>
                  <li>• プロジェクト作成後は、大タスクと小タスクに分割して管理しましょう</li>
                  <li>• 定期的に進捗をレビューして、必要に応じて調整を行いましょう</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}