import { Badge } from '@/components/ui/badge'
import { type Tone } from '@/lib/domain/labels'
import { cn } from '@/lib/utils'

const TONE_VARIANT = {
  ok: 'success',
  warn: 'warning',
  danger: 'destructive',
  info: 'info',
  neutral: 'secondary',
} as const

export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge variant={TONE_VARIANT[tone]} className={cn(className)}>
      {children}
    </Badge>
  )
}
