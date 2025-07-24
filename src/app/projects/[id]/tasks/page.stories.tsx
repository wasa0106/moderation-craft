import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import TaskManagementPage from './page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Project, BigTask, SmallTask } from '@/types'
import React from 'react'

// Mock data
const mockProject: Project = {
  id: 'project-1',
  name: 'テストプロジェクト',
  goal: '2024年度のプロジェクト目標',
  deadline: new Date('2024-12-31').toISOString(),
  status: 'active',
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
    user_id: 'user-1',
    name: '要件定義',
    category: '企画・設計',
    week_number: 1,
    week_start_date: new Date('2024-01-01').toISOString(),
    week_end_date: new Date('2024-01-07').toISOString(),
    estimated_hours: 8,
    actual_hours: 10,
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
    user_id: 'user-1',
    name: '設計',
    category: '企画・設計',
    week_number: 2,
    week_start_date: new Date('2024-01-08').toISOString(),
    week_end_date: new Date('2024-01-14').toISOString(),
    estimated_hours: 16,
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
    user_id: 'user-1',
    name: '実装',
    category: '実装',
    week_number: 3,
    week_start_date: new Date('2024-01-15').toISOString(),
    week_end_date: new Date('2024-01-21').toISOString(),
    estimated_hours: 40,
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
    user_id: 'user-1',
    name: 'ヒアリング実施',
    estimated_minutes: 120,
    scheduled_start: new Date('2024-01-10T09:00:00').toISOString(),
    scheduled_end: new Date('2024-01-10T11:00:00').toISOString(),
    actual_start: new Date('2024-01-10T09:00:00').toISOString(),
    actual_end: new Date('2024-01-10T11:30:00').toISOString(),
    actual_minutes: 150,
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
    user_id: 'user-1',
    name: '要件書作成',
    estimated_minutes: 240,
    scheduled_start: new Date('2024-01-11T09:00:00').toISOString(),
    scheduled_end: new Date('2024-01-11T13:00:00').toISOString(),
    actual_start: new Date('2024-01-11T09:00:00').toISOString(),
    actual_end: new Date('2024-01-11T14:00:00').toISOString(),
    actual_minutes: 300,
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
    user_id: 'user-1',
    name: 'DB設計',
    estimated_minutes: 180,
    scheduled_start: new Date('2024-01-15T09:00:00').toISOString(),
    scheduled_end: new Date('2024-01-15T12:00:00').toISOString(),
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
    user_id: 'user-1',
    name: 'API設計（緊急）',
    estimated_minutes: 120,
    scheduled_start: new Date('2024-01-16T09:00:00').toISOString(),
    scheduled_end: new Date('2024-01-16T11:00:00').toISOString(),
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
  // @ts-expect-error - Mocking window.__mockHooks for Storybook
  window.__mockHooks = mockHooks
  
  // Override the actual imports
  const originalRequire = require
  // @ts-expect-error - Overriding require for module mocking
  require = function(id: string, ...args: any[]) {
    // @ts-expect-error - Using window.__mockHooks for testing
    if (id === '@/hooks/use-projects') return { useProjects: window.__mockHooks.useProjects }
    // @ts-expect-error - Using window.__mockHooks for testing
    if (id === '@/hooks/use-big-tasks') return { useBigTasks: window.__mockHooks.useBigTasks }
    // @ts-expect-error - Using window.__mockHooks for testing
    if (id === '@/hooks/use-small-tasks') return { useSmallTasks: window.__mockHooks.useSmallTasks }
    // @ts-expect-error - Using this context for require
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