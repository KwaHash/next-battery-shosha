'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function SignOutButton({
  className,
  label = 'サインアウト',
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={signOut}
      className={cn(
        'group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-active hover:text-foreground disabled:opacity-50',
        className,
      )}
    >
      <LogOut className="mr-3 size-5 text-muted-foreground group-hover:text-foreground" aria-hidden />
      {label}
    </button>
  )
}
