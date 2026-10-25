'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarDays, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatIsoDate, parseIsoDate, today } from '@/lib/domain/clock'
import { cn } from '@/lib/utils'

const QUICK_PICKS = [
  { label: '明日', offset: 1 },
  { label: 'あさって', offset: 2 },
  { label: '3日後', offset: 3 },
  { label: '来週', offset: 7 },
] as const

/** genba の DateField と同じ操作。受付は PC なので大きさだけ詰めている。 */
export function DateField({
  id,
  value,
  onChange,
  clearable = false,
  quickPicks = true,
  placeholder = '日付を選ぶ',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  quickPicks?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)
  const minDate = parseIsoDate(today())

  return (
    <div className="space-y-2">
      {quickPicks ? (
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_PICKS.map(({ label, offset }) => {
            const date = today(offset)
            return (
              <Button
                key={label}
                type="button"
                variant={value === date ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange(date)}
              >
                {label}
              </Button>
            )
          })}
        </div>
      ) : null}

      <div className="flex gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              id={id}
              className={cn(
                'flex-1 justify-start px-3 font-normal',
                !value && 'text-muted-foreground',
              )}
            >
              <CalendarDays className="mr-2 size-4 shrink-0" aria-hidden />
              {selected ? format(selected, 'yyyy年M月d日（E）', { locale: ja }) : placeholder}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => {
                onChange(date ? formatIsoDate(date) : '')
                setOpen(false)
              }}
              disabled={(date) => (minDate ? date < minDate : false)}
              defaultMonth={selected}
              locale={ja}
              labels={{
                labelPrevious: () => '前の月',
                labelNext: () => '次の月',
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        {clearable && value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="日付を消す"
            onClick={() => onChange('')}
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
