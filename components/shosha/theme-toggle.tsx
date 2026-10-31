'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/** 既定はダーク。明るい部屋や印刷前の確認用にライトへ切り替えられる。 */
export function ThemeToggle({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const dark = !mounted || resolvedTheme !== 'light'

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={iconOnly ? (dark ? 'ライトモードにする' : 'ダークモードにする') : undefined}
      className={cn(
        'group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-active hover:text-foreground',
        className,
      )}
    >
      {dark ? (
        <Sun className={cn('size-5 text-muted-foreground group-hover:text-foreground', !iconOnly && 'mr-3')} aria-hidden />
      ) : (
        <Moon className={cn('size-5 text-muted-foreground group-hover:text-foreground', !iconOnly && 'mr-3')} aria-hidden />
      )}
      {iconOnly ? null : dark ? 'ライトモード' : 'ダークモード'}
    </button>
  )
}
