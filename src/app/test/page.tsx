'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/db/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { projectRepository } from '@/lib/db/repositories'
import type { CreateProjectData } from '@/types'

export default function TestPage() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const addLog = (message: string) => {
    console.log(message)
    setTestResults(prev => [...prev, message])
  }

  useEffect(() => {
    const runTests = async () => {
      addLog('🧪 === データベーステスト開始 ===')

      try {
        // 1. データベース基本確認
        addLog(`✅ Database instance: ${db ? 'OK' : 'NG'}`)
        addLog(`✅ Database open?: ${db.isOpen()}`)
        addLog(`✅ Database name: ${db.name}`)
        addLog(`✅ Tables count: ${db.tables.length}`)
        addLog(`✅ Table names: ${db.tables.map(t => t.name).join(', ')}`)

        // 2. 初期データ数確認
        const initialCount = await db.projects.count()
        addLog(`📊 Initial projects count: ${initialCount}`)

        // 3. テストプロジェクト作成
        const testProject: CreateProjectData = {
          user_id: 'test_user_123',
          name: '🎮 同人ゲーム制作',
          goal: '100部完売',
          deadline: '2025-10-15',
          status: 'active',
          version: 1
        }

        addLog('📝 Creating test project...')
        const createdProject = await projectRepository.create(testProject)
        addLog(`✅ Project created with ID: ${createdProject.id}`)

        // 4. 作成されたプロジェクト取得
        const savedProject = await projectRepository.getById(createdProject.id)
        addLog(`📖 Retrieved project: ${savedProject?.name}`)

        // 5. 最終確認
        const finalCount = await db.projects.count()
        addLog(`📊 Final projects count: ${finalCount}`)
        addLog(`🎉 Test completed! Projects: ${initialCount} → ${finalCount}`)

      } catch (error) {
        addLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.error('Full error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    runTests()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>🧪 データベース動作確認</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>テスト実行中...</div>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold">テスト結果:</p>
              <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono">
                    {result}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-4">
                詳細はブラウザの開発者ツール（Console）でも確認できます
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
