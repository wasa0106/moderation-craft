/**
 * ProjectColorPicker - プロジェクトカラー選択コンポーネント
 * Select UI でプリセットカラーを選択、カスタムカラーは Popover で入力
 *
 * 注意: プロジェクトカラーはユーザーが選択するカスタムカラーのため、
 * システムのセマンティックカラーとは独立して扱う必要があります。
 * カラープレビュー部分のみインラインスタイルを使用しています。
 */

'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Palette } from 'lucide-react'

// プリセットカラーの定義
// 注意: これらはプロジェクトごとにユーザーが選択できるカスタムカラーです。
// システムのセマンティックカラーとは異なり、プロジェクトの識別に使用されます。
// 彩度42%、明度55%で統一し、プライマリカラーと調和する設計になっています。
export const PRESET_COLORS = [
  { name: 'Green', value: 'hsl(137, 42%, 55%)', hex: '#5DAB70' },
  { name: 'Red', value: 'hsl(0, 42%, 55%)', hex: '#C7595F' },
  { name: 'Blue', value: 'hsl(210, 42%, 55%)', hex: '#4A90C7' },
  { name: 'Purple', value: 'hsl(270, 42%, 55%)', hex: '#9570C7' },
  { name: 'Orange', value: 'hsl(30, 42%, 55%)', hex: '#C7844A' },
  { name: 'Yellow', value: 'hsl(60, 42%, 55%)', hex: '#C7C74A' },
  { name: 'Pink', value: 'hsl(330, 42%, 55%)', hex: '#C75995' },
  { name: 'Cyan', value: 'hsl(180, 42%, 55%)', hex: '#4AC7C7' },
  { name: 'Magenta', value: 'hsl(300, 42%, 55%)', hex: '#C74AC7' },
]

// カスタムカラーの特別な値
const CUSTOM_COLOR_VALUE = 'custom'

// HEX to HSL 変換関数
function hexToHsl(hex: string): string {
  // Remove the hash if present
  hex = hex.replace(/^#/, '')
  
  // Parse the hex values
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  
  let h = 0
  let s = 0
  const l = (max + min) / 2
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / diff + 2) / 6
        break
      case b:
        h = ((r - g) / diff + 4) / 6
        break
    }
  }
  
  const hDegrees = Math.round(h * 360)
  const sPercent = Math.round(s * 100)
  const lPercent = Math.round(l * 100)
  
  return `hsl(${hDegrees}, ${sPercent}%, ${lPercent}%)`
}

// HSL to HEX 変換関数
function hslToHex(hsl: string): string {
  // Parse HSL string
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return '#000000'
  
  const h = parseInt(match[1]) / 360
  const s = parseInt(match[2]) / 100
  const l = parseInt(match[3]) / 100
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  
  let r, g, b
  
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

interface ProjectColorPickerProps {
  value?: string
  onChange: (color: string) => void
  className?: string
}

export function ProjectColorPicker({
  value = PRESET_COLORS[0].value,
  onChange,
  className,
}: ProjectColorPickerProps) {
  const [customColor, setCustomColor] = useState('')
  const [colorPickerValue, setColorPickerValue] = useState('#000000')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(value)

  // 現在の色がプリセットかどうか判定
  const isPresetColor = PRESET_COLORS.some(color => color.value === value)
  const selectValue = isPresetColor ? value : CUSTOM_COLOR_VALUE

  const handleSelectChange = (newValue: string) => {
    if (newValue === CUSTOM_COLOR_VALUE) {
      // setTimeoutで少し遅らせてPopoverを開く
      // これにより、Selectメニューのクリックイベントが完了してからPopoverが開く
      setTimeout(() => {
        setPopoverOpen(true)
        // カスタムカラーが未設定の場合はデフォルト値を設定
        if (!customColor && !isPresetColor) {
          setCustomColor(value)
          setColorPickerValue(hslToHex(value))
        }
      }, 100)
    } else {
      onChange(newValue)
      setInternalValue(newValue)
      setPopoverOpen(false)
    }
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setCustomColor(color)
    if (color.match(/^hsl\(\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%\)$/)) {
      onChange(color)
      setInternalValue(color)
      setColorPickerValue(hslToHex(color))
    }
  }

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hexColor = e.target.value
    setColorPickerValue(hexColor)
    const hslColor = hexToHsl(hexColor)
    setCustomColor(hslColor)
    onChange(hslColor)
    setInternalValue(hslColor)
  }

  const handlePopoverClose = () => {
    setPopoverOpen(false)
    
    // カスタムカラーが有効な場合は、そのカラーを確定
    if (customColor.match(/^hsl\(\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%\)$/)) {
      onChange(customColor)
      setInternalValue(customColor)
    } else {
      // 無効な場合は最初のプリセットに戻す
      const firstPreset = PRESET_COLORS[0].value
      onChange(firstPreset)
      setInternalValue(firstPreset)
    }
  }

  // 表示用の色とラベルを取得
  const displayColor = isPresetColor
    ? PRESET_COLORS.find(c => c.value === value)
    : { name: 'カスタムカラー', value: value }

  return (
    <div className={cn('space-y-2', className)}>
      <Label>プロジェクトカラー</Label>
      <div className="relative">
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {displayColor && (
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-sm border border-border"
                    style={{
                      backgroundColor: displayColor.value,
                    }}
                  />
                  <span>{displayColor.name}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRESET_COLORS.map((color) => (
              <SelectItem key={color.value} value={color.value}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-sm border border-border"
                    style={{
                      backgroundColor: color.value,
                    }}
                  />
                  <span>{color.name}</span>
                </div>
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_COLOR_VALUE}>
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-muted-foreground" />
                <span>カスタムカラー</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* カスタムカラー入力用の Popover */}
        <Popover 
          open={popoverOpen} 
          onOpenChange={(open) => {
            if (!open) {
              handlePopoverClose()
            }
          }}
          modal={true}
        >
          <PopoverTrigger asChild>
            <span />
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-4"
            align="start"
            onInteractOutside={handlePopoverClose}
            onEscapeKeyDown={handlePopoverClose}
          >
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  カスタムカラー
                </h4>
                <div className="space-y-4">
                  {/* カラーピッカー */}
                  <div className="space-y-2">
                    <Label className="text-xs">視覚的に選択</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colorPickerValue}
                        onChange={handleColorPickerChange}
                        className="h-10 w-20 cursor-pointer rounded border border-border"
                      />
                      <span className="text-sm text-muted-foreground">
                        クリックして色を選択
                      </span>
                    </div>
                  </div>
                  
                  {/* 区切り線 */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-popover px-2 text-muted-foreground">または</span>
                    </div>
                  </div>
                  
                  {/* HSL入力 */}
                  <div className="space-y-2">
                    <Label className="text-xs">HSL値を直接入力</Label>
                    <Input
                      type="text"
                      placeholder="hsl(0, 42%, 55%)"
                      value={customColor}
                      onChange={handleCustomColorChange}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      例: hsl(120, 50%, 60%)
                    </p>
                  </div>
                  
                  {/* プレビュー */}
                  {customColor && (
                    <div className="space-y-2">
                      <Label className="text-xs">プレビュー</Label>
                      <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-surface-1">
                        <div
                          className="w-10 h-10 rounded-md border border-border"
                          style={{
                            backgroundColor: customColor,
                          }}
                        />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium text-foreground">選択中の色</p>
                          <p className="text-xs font-mono text-muted-foreground">{customColor}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 選択された色のプレビュー */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>選択中:</span>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded border border-border"
            style={{
              backgroundColor: internalValue,
            }}
          />
          <span className="font-mono text-xs">{internalValue}</span>
        </div>
      </div>
    </div>
  )
}
