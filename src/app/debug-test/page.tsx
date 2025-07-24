'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugTestPage() {
  const [debugResult, setDebugResult] = useState<string>('')

  useEffect(() => {
    // Check if debug utilities are loaded
    if (typeof window !== 'undefined') {
      const checkInterval = setInterval(() => {
        if ((window as any).quickDebug && (window as any).debugUtils) {
          clearInterval(checkInterval)
          console.log('✅ Debug utilities are loaded and ready')
        }
      }, 500)

      return () => clearInterval(checkInterval)
    }
  }, [])

  const runQuickDebug = async () => {
    try {
      const quickDebug = (window as any).quickDebug
      if (!quickDebug) {
        setDebugResult('Debug utilities not loaded yet. Please wait...')
        return
      }

      setDebugResult('Running quick debug...')
      const result = await quickDebug()
      setDebugResult(
        `Projects: ${result.projects.length}, BigTasks: ${result.bigTasks.length}, Orphaned: ${result.orphanCount}`
      )
    } catch (error) {
      setDebugResult(`Error: ${error}`)
    }
  }

  const runDetailedDebug = async () => {
    try {
      const debugUtils = (window as any).debugUtils
      if (!debugUtils) {
        setDebugResult('Debug utilities not loaded yet. Please wait...')
        return
      }

      setDebugResult('Running detailed debug check...')
      await debugUtils.checkBigTaskProjectRelations()
      setDebugResult('Check complete! See browser console for details.')
    } catch (error) {
      setDebugResult(`Error: ${error}`)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Debug Utilities Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={runQuickDebug}>Run Quick Debug</Button>
            <Button onClick={runDetailedDebug} variant="outline">
              Run Detailed Debug
            </Button>
          </div>

          {debugResult && (
            <div className="p-4 bg-muted rounded-lg">
              <pre className="text-sm">{debugResult}</pre>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p>Open browser console (F12) to see detailed output.</p>
            <p>Available console commands:</p>
            <ul className="list-disc ml-5 mt-2">
              <li>
                <code>quickDebug()</code> - Quick check
              </li>
              <li>
                <code>debugUtils.checkBigTaskProjectRelations()</code> - Detailed check
              </li>
              <li>
                <code>debugUtils.showDetailedDataInfo()</code> - Show all data
              </li>
              <li>
                <code>debugUtils.diagnoseProjectCreation()</code> - Diagnose creation
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
