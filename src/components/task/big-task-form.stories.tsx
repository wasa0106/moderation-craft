// 1. 必要なものをインポート
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BigTaskForm } from './big-task-form' // 自分のコンポーネント

// 2. メタ情報（設定）
const meta: Meta<typeof BigTaskForm> = {
  title: 'Tasks/BigTaskForm', // Storybookでの表示名
  component: BigTaskForm, // 対象のコンポーネント
}

export default meta

// 3. ストーリーの型定義
type Story = StoryObj<typeof meta>

// 4. ストーリー（パターン）を作る
export const Default: Story = {
  args: {
    // ここにpropsを書く
  },
}
