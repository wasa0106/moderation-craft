// big-task-list.stories.tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BigTaskList } from './big-task-list'

const meta: Meta<typeof BigTaskList> = {
  title: 'Tasks/BigTaskList',
  component: BigTaskList,
  // デフォルトで全ての必須propsを設定！
  args: {
    bigTasks: [],
    onEdit: task => console.log('Edit:', task),
    onDelete: taskId => console.log('Delete:', taskId),
    onCreateSmallTask: bigTaskId => console.log('Create small task for:', bigTaskId),
    isLoading: false,
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// 読み込み中
export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

// 空の状態
export const Empty: Story = {
  args: {
    bigTasks: [],
  },
}

// タスクがある状態
export const WithTasks: Story = {
  args: {
    bigTasks: [
      {
        id: '1',
        name: '企画書を作成する',
        description: '来月のプレゼン用',
        category: 'ドキュメント作成',
        week_number: 10,
        estimated_hours: 24,
        actual_hours: 12,
        priority: 'high',
        status: 'active',
        project_id: 'project-1',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'UIデザインを完成させる',
        description: 'Figmaで作業',
        category: 'デザイン',
        week_number: 11,
        estimated_hours: 16,
        actual_hours: 8,
        priority: 'medium',
        status: 'pending',
        project_id: 'project-1',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
}
