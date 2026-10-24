'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 現場から届いた依頼を受信箱に出す。開いている間だけ一定間隔で読み直す。
 * 画面が裏に回っている間は読まない（タブを開きっぱなしにされるため）。
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'visible') router.refresh()
    }

    const timer = window.setInterval(refresh, intervalMs)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [router, intervalMs])

  return null
}
