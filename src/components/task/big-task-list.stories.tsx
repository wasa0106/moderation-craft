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
    onUpdate: async (params) => {
      console.log('Update:', params)
      return params.data as any
    },
    onDelete: taskId => console.log('Delete:', taskId),
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
        estimated_hours: 24,
        actual_hours: 12,
        priority: 'high',
        status: 'active',
        project_id: 'project-1',
        user_id: 'user-1',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'UIデザインを完成させる',
        description: 'Figmaで作業',
        category: 'デザイン',
        estimated_hours: 16,
        actual_hours: 8,
        priority: 'medium',
        status: 'active',
        project_id: 'project-1',
        user_id: 'user-1',
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
}
