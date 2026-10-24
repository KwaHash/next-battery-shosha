'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

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
    <Button variant="outline" size="sm" className={className} disabled={pending} onClick={signOut}>
      <LogOut className="mr-2 size-4" aria-hidden />
      {label}
    </Button>
  )
}
