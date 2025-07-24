import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import TaskManagementPage from './page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Project, BigTask, SmallTask } from '@/types'
import React from 'react'

// Mock data
const mockProject: Project = {
  id: 'project-1',
  name: 'テストプロジェクト',
  description: 'これはテスト用のプロジェクトです',
  user_id: 'user-1',
  created_at: new Date('2024-01-01').toISOString(),
  updated_at: new Date('2024-01-01').toISOString(),
  last_sync_at: null,
  version: 1,
  sync_status: 'synced',
}

const mockBigTasks: BigTask[] = [
  {
    id: 'big-task-1',
    project_id: 'project-1',
    name: '要件定義',
    wbs_number: '1.0',
    planned_minutes: 480,
    status: 'completed',
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date('2024-01-02').toISOString(),
    last_sync_at: null,
    version: 1,
    sync_status: 'synced',
  },
  {
    id: 'big-task-2',
    project_id: 'project-1',
    name: '設計',
    wbs_number: '2.0',
    planned_minutes: 960,
    status: 'active',
    created_at: new Date('2024-01-02').toISOString(),
    updated_at: new Date('2024-01-03').toISOString(),
    last_sync_at: null,
    version: 1,
    sync_status: 'synced',
  },
  {
    id: 'big-task-3',
    project_id: 'project-1',
    name: '実装',
    wbs_number: '3.0',
    planned_minutes: 2400,
    status: 'pending',
    created_at: new Date('2024-01-03').toISOString(),
    updated_at: new Date('2024-01-03').toISOString(),
    last_sync_at: null,
    version: 1,
    sync_status: 'synced',
  },
]

const mockSmallTasks: SmallTask[] = [
  {
    id: 'small-task-1',
    big_task_id: 'big-task-1',
    name: 'ヒアリング実施',
    estimated_minutes: 120,
    actual_minutes: 150,
    date: '2024-01-10',
    is_emergency: false,
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date('2024-01-10').toISOString(),
    last_sync_at: null,
    version: 1,
    sync_status: 'synced',
  },
  {
    id: 'small-task-2',
    big_task_id: 'big-task-1',
    name: '要件書作成',
    estimated_minutes: 240,
    actual_minutes: 300,
    date: '2024-01-11',
    is_emergency: false,
    created_at: new Date('2024-01-02').toISOString(),
    updated_at: new Date('2024-01-11').toISOString(),
    last_sync_at: null,
    version: 1,
    sync_status: 'synced',
  },
  {
    id: 'small-task-3',
    big_task_id: 'big-task-2',
    name: 'DB設計',
    estimated_minutes: 180,
    actual_minutes: 0,
    date: '2024-01-15',
    is_emergency: false,
    created_at: new Date('2024-01-05').toISOString(),
    updated_at: new Date('2024-01-05').toISOString(),
    last_sync_at: null,
    version: 1,
    sync_status: 'synced',
  },
  {
    id: 'small-task-4',
    big_task_id: 'big-task-2',
    name: 'API設計（緊急）',
    estimated_minutes: 120,
    actual_minutes: 0,
    date: '2024-01-16',
    is_emergency: true,
    created_at: new Date('2024-01-06').toISOString(),
    updated_at: new Date('2024-01-06').toISOString(),
    last_sync_at: null,
    version: 1,
    sync_status: 'synced',
  },
]

// Mock Context Provider
interface MockDataContextValue {
  projects: Project[]
  bigTasks: BigTask[]
  smallTasks: SmallTask[]
  isLoading?: boolean
}

const MockDataContext = React.createContext<MockDataContextValue>({
  projects: [],
  bigTasks: [],
  smallTasks: [],
  isLoading: false,
})

interface MockProviderProps {
  children: React.ReactNode
  mockData?: Partial<MockDataContextValue>
}

const MockProvider: React.FC<MockProviderProps> = ({ children, mockData = {} }) => {
  const value: MockDataContextValue = {
    projects: mockData.projects || [mockProject],
    bigTasks: mockData.bigTasks || mockBigTasks,
    smallTasks: mockData.smallTasks || mockSmallTasks,
    isLoading: mockData.isLoading || false,
  }

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>
}

// Mock hooks
const createMockHooks = (mockData: MockDataContextValue) => {
  const useProjects = () => {
    const context = React.useContext(MockDataContext)
    return {
      projects: context.projects,
      isLoading: context.isLoading || false,
      error: null,
      createProject: async () => context.projects[0],
      updateProject: async () => context.projects[0],
      deleteProject: async () => {},
    }
  }

  const useBigTasks = () => {
    const context = React.useContext(MockDataContext)
    return {
      bigTasks: context.bigTasks,
      isLoading: context.isLoading || false,
      error: null,
      createBigTask: async () => context.bigTasks[0],
      updateBigTask: async () => context.bigTasks[0],
      deleteBigTask: async () => {},
    }
  }

  const useSmallTasks = () => {
    const context = React.useContext(MockDataContext)
    return {
      smallTasks: context.smallTasks,
      isLoading: context.isLoading || false,
      error: null,
      createSmallTask: async () => context.smallTasks[0],
      updateSmallTask: async () => context.smallTasks[0],
      deleteSmallTask: async () => {},
    }
  }

  return { useProjects, useBigTasks, useSmallTasks }
}

// Create wrapper component
const createWrapper = (mockData?: Partial<MockDataContextValue>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const ProviderComponent = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MockProvider mockData={mockData}>{children}</MockProvider>
    </QueryClientProvider>
  )
  
  ProviderComponent.displayName = 'MockQueryProvider'
  
  return ProviderComponent
}

// Replace hooks with mocks in module scope
const mockHooks = createMockHooks({
  projects: [mockProject],
  bigTasks: mockBigTasks,
  smallTasks: mockSmallTasks,
})

// Module mock replacements
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  // @ts-expect-error
  window.__mockHooks = mockHooks
  
  // Override the actual imports
  const originalRequire = require
  // @ts-expect-error
  require = function(id: string, ...args: any[]) {
    if (id === '@/hooks/use-projects') return { useProjects: window.__mockHooks.useProjects }
    if (id === '@/hooks/use-big-tasks') return { useBigTasks: window.__mockHooks.useBigTasks }
    if (id === '@/hooks/use-small-tasks') return { useSmallTasks: window.__mockHooks.useSmallTasks }
    return originalRequire.apply(this, [id, ...args])
  }
}

const meta: Meta<typeof TaskManagementPage> = {
  title: 'Pages/TaskManagement',
  component: TaskManagementPage,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      navigation: {
        pathname: '/projects/[id]/tasks',
        query: { id: 'project-1' },
      },
    },
  },
  decorators: [
    (Story, context) => {
      const Wrapper = createWrapper(context.parameters.mockData)
      return (
        <Wrapper>
          <Story />
        </Wrapper>
      )
    },
  ],
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    params: Promise.resolve({ id: 'project-1' }),
  },
}

export const Loading: Story = {
  args: {
    params: Promise.resolve({ id: 'project-1' }),
  },
  parameters: {
    mockData: {
      projects: [mockProject],
      bigTasks: mockBigTasks,
      smallTasks: mockSmallTasks,
      isLoading: true,
    },
  },
}

export const ProjectNotFound: Story = {
  args: {
    params: Promise.resolve({ id: 'non-existent-project' }),
  },
  parameters: {
    mockData: {
      projects: [],
      bigTasks: [],
      smallTasks: [],
    },
  },
}

export const EmptyTasks: Story = {
  args: {
    params: Promise.resolve({ id: 'project-1' }),
  },
  parameters: {
    mockData: {
      projects: [mockProject],
      bigTasks: [],
      smallTasks: [],
    },
  },
}

export const OnlyBigTasks: Story = {
  args: {
    params: Promise.resolve({ id: 'project-1' }),
  },
  parameters: {
    mockData: {
      projects: [mockProject],
      bigTasks: mockBigTasks,
      smallTasks: [],
    },
  },
}