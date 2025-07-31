import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TaskMemo } from '../task-memo'

// localStorageのモック
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

// windowオブジェクトが存在する場合のみlocalStorageをモック
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })
}

describe('TaskMemo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('コンポーネントが正しくレンダリングされる', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<TaskMemo value="" onChange={onChange} onSave={onSave} />)
    
    const textarea = screen.getByPlaceholderText('今週の計画、意識したいこと、目標などを記入してください...')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveClass('min-h-[300px]', 'font-mono', 'text-sm')
  })

  it('初期値が正しく表示される', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    const initialValue = 'テストメモの内容'
    render(<TaskMemo value={initialValue} onChange={onChange} onSave={onSave} />)
    
    const textarea = screen.getByPlaceholderText('今週の計画、意識したいこと、目標などを記入してください...')
    expect(textarea).toHaveValue(initialValue)
  })

  it('値の変更が正しく処理される', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<TaskMemo value="" onChange={onChange} onSave={onSave} />)
    
    const textarea = screen.getByPlaceholderText('今週の計画、意識したいこと、目標などを記入してください...')
    const newValue = '新しいメモの内容'
    
    fireEvent.change(textarea, { target: { value: newValue } })
    
    expect(onChange).toHaveBeenCalledWith(newValue)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('保存ボタンのクリックでonSaveが呼ばれる', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<TaskMemo value="テスト" onChange={onChange} onSave={onSave} isDirty={true} />)
    
    const saveButton = screen.getByRole('button', { name: /保存/ })
    fireEvent.click(saveButton)
    
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('isDirtyがfalseの場合、保存ボタンが無効化される', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<TaskMemo value="" onChange={onChange} onSave={onSave} isDirty={false} />)
    
    const saveButton = screen.getByRole('button', { name: /保存/ })
    expect(saveButton).toBeDisabled()
  })

  it('Ctrl+S/Cmd+Sで保存が実行される', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<TaskMemo value="テスト" onChange={onChange} onSave={onSave} isDirty={true} />)
    
    const textarea = screen.getByPlaceholderText('今週の計画、意識したいこと、目標などを記入してください...')
    
    // Ctrl+S
    fireEvent.keyDown(textarea, { key: 's', ctrlKey: true })
    expect(onSave).toHaveBeenCalledTimes(1)
    
    // Cmd+S
    fireEvent.keyDown(textarea, { key: 's', metaKey: true })
    expect(onSave).toHaveBeenCalledTimes(2)
  })


  it('保存中は保存ボタンが無効化される', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<TaskMemo value="テスト" onChange={onChange} onSave={onSave} isDirty={true} isSaving={true} />)
    
    const saveButton = screen.getByRole('button', { name: /保存/ })
    expect(saveButton).toBeDisabled()
    
    // 保存中のテキストが表示される
    expect(screen.getByText('保存中...')).toBeInTheDocument()
  })
})