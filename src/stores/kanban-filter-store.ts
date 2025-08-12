import { create } from 'zustand'

export interface KanbanFilters {
  status: {
    active: boolean
    completed: boolean
    cancelled: boolean
  }
}

interface KanbanFilterStore {
  // フィルター設定
  filters: KanbanFilters
  
  // BigTaskの表示状態（非表示のBigTask IDのセット）
  hiddenBigTaskIds: Set<string>
  
  // 選択されたBigTask IDのセット
  selectedBigTaskIds: Set<string>
  
  // パネルの開閉状態
  isPanelOpen: boolean
  
  // アクション
  togglePanel: () => void
  closePanel: () => void
  setFilters: (filters: Partial<KanbanFilters>) => void
  resetFilters: () => void
  toggleStatus: (status: 'active' | 'completed' | 'cancelled') => void
  
  // BigTask表示管理
  toggleBigTaskVisibility: (bigTaskId: string) => void
  showAllBigTasks: () => void
  hideAllBigTasks: (bigTaskIds: string[]) => void
  isBigTaskVisible: (bigTaskId: string) => boolean
  
  // BigTask選択管理
  toggleBigTaskSelection: (bigTaskId: string) => void
  selectAllBigTasks: (bigTaskIds: string[]) => void
  clearBigTaskSelection: () => void
  isBigTaskSelected: (bigTaskId: string) => boolean
  
  // ヘルパー
  getActiveFilterCount: () => number
  isDefaultFilters: () => boolean
}

const defaultFilters: KanbanFilters = {
  status: {
    active: true,
    completed: false,
    cancelled: false,
  },
}

export const useKanbanFilterStore = create<KanbanFilterStore>((set, get) => ({
  filters: defaultFilters,
  hiddenBigTaskIds: new Set<string>(),
  selectedBigTaskIds: new Set<string>(),
  isPanelOpen: false,
  
  togglePanel: () => set(state => ({ isPanelOpen: !state.isPanelOpen })),
  closePanel: () => set({ isPanelOpen: false }),
  
  setFilters: (filters) => set(state => ({
    filters: { ...state.filters, ...filters }
  })),
  
  resetFilters: () => set({ filters: defaultFilters, hiddenBigTaskIds: new Set<string>(), selectedBigTaskIds: new Set<string>() }),
  
  toggleStatus: (status) => set(state => ({
    filters: {
      ...state.filters,
      status: {
        ...state.filters.status,
        [status]: !state.filters.status[status],
      },
    },
  })),
  
  
  // BigTask表示管理
  toggleBigTaskVisibility: (bigTaskId) => set(state => {
    const newSet = new Set(state.hiddenBigTaskIds)
    if (newSet.has(bigTaskId)) {
      newSet.delete(bigTaskId)
    } else {
      newSet.add(bigTaskId)
    }
    return { hiddenBigTaskIds: newSet }
  }),
  
  showAllBigTasks: () => set({ hiddenBigTaskIds: new Set<string>() }),
  
  hideAllBigTasks: (bigTaskIds) => set({ hiddenBigTaskIds: new Set(bigTaskIds) }),
  
  isBigTaskVisible: (bigTaskId) => !get().hiddenBigTaskIds.has(bigTaskId),
  
  // BigTask選択管理
  toggleBigTaskSelection: (bigTaskId) => set(state => {
    const newSet = new Set(state.selectedBigTaskIds)
    if (newSet.has(bigTaskId)) {
      newSet.delete(bigTaskId)
    } else {
      newSet.add(bigTaskId)
    }
    return { selectedBigTaskIds: newSet }
  }),
  
  selectAllBigTasks: (bigTaskIds) => set({ selectedBigTaskIds: new Set(bigTaskIds) }),
  
  clearBigTaskSelection: () => set({ selectedBigTaskIds: new Set<string>() }),
  
  isBigTaskSelected: (bigTaskId) => get().selectedBigTaskIds.has(bigTaskId),
  
  getActiveFilterCount: () => {
    const { filters, selectedBigTaskIds } = get()
    let count = 0
    
    // ステータスフィルター（デフォルトから変更されているもの）
    if (!filters.status.active) count++
    if (filters.status.completed) count++
    if (filters.status.cancelled) count++
    
    // 選択されたBigTask
    if (selectedBigTaskIds.size > 0) count++
    
    return count
  },
  
  isDefaultFilters: () => {
    const { filters, selectedBigTaskIds } = get()
    return (
      filters.status.active === defaultFilters.status.active &&
      filters.status.completed === defaultFilters.status.completed &&
      filters.status.cancelled === defaultFilters.status.cancelled &&
      selectedBigTaskIds.size === 0
    )
  },
}))