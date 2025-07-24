/**
 * Quick debug script to check BigTask-Project relationships
 * Run this in the browser console
 */

export async function quickDebug() {
  const { db } = await import('@/lib/db/database')

  console.log('=== Quick Debug: BigTask-Project Relations ===')

  // Get all projects
  const projects = await db.projects.toArray()
  console.log('\n📋 Projects:', projects.length)
  projects.forEach(p => {
    console.log(`  - ${p.name} (ID: ${p.id})`)
  })

  // Get all BigTasks
  const bigTasks = await db.bigTasks.toArray()
  console.log('\n📝 BigTasks:', bigTasks.length)

  // Check each BigTask
  let orphanCount = 0
  bigTasks.forEach(task => {
    const project = projects.find(p => p.id === task.project_id)
    if (!project) {
      console.log(`\n❌ Orphaned BigTask:`)
      console.log(`  Name: ${task.name}`)
      console.log(`  project_id: ${task.project_id}`)
      orphanCount++
    } else {
      console.log(`\n✅ ${task.name} -> ${project.name}`)
    }
  })

  console.log(`\n📊 Summary: ${orphanCount} orphaned BigTasks out of ${bigTasks.length}`)

  // Show the most recent BigTask
  if (bigTasks.length > 0) {
    const latest = bigTasks.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    console.log('\n🆕 Latest BigTask:')
    console.log(latest)
  }

  return { projects, bigTasks, orphanCount }
}

// Make it available globally
if (typeof window !== 'undefined') {
  ;(window as any).quickDebug = quickDebug
}
