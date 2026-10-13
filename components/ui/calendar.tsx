'use client'

import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const navButtonClass = cn(
  buttonVariants({ variant: 'ghost' }),
  'size-11 p-0 !rounded-full opacity-70 hover:!bg-primary hover:!text-primary-foreground'
    + ' hover:opacity-100',
)

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  navLayout = 'around',
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout}
      className={cn('calendar-root p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4',
        month: 'relative flex w-fit flex-col items-center gap-4',
        month_caption: 'flex h-11 items-center justify-center pt-1',
        caption_label:
          'inline-flex items-center gap-0.5 px-1 py-0.5 text-base font-bold',
        dropdowns: 'flex items-center justify-center gap-3',
        dropdown_root: 'relative inline-flex items-center',
        dropdown:
          'absolute inset-0 z-[1] size-full cursor-pointer text-base opacity-0',
        nav: 'flex items-center gap-1',
        button_previous: cn(navButtonClass, 'absolute left-1 top-0'),
        button_next: cn(navButtonClass, 'absolute right-1 top-0'),
        month_grid: 'border-collapse space-y-1',
        weekdays: 'flex [&>th:first-child]:!text-destructive',
        weekday: 'w-11 text-sm font-normal text-muted-foreground',
        week: 'mt-1 flex [&>td:first-child]:!text-destructive',
        day: 'relative size-11 !rounded-full p-0 text-center text-base'
          + ' focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-11 !rounded-full p-0 text-base font-normal hover:bg-muted',
        ),
        range_end: 'day-range-end',
        selected:
          '!rounded-full [&>button]:!bg-primary [&>button]:!text-primary-foreground'
          + ' [&>button]:!font-bold [&>button]:hover:!bg-primary',
        today: '!rounded-full [&>button]:bg-muted [&>button]:font-bold',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-40',
        range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === 'left') return <ChevronLeft className="size-5" />
          if (orientation === 'right') return <ChevronRight className="size-5" />
          return <ChevronDown className="ml-1 size-4 text-muted-foreground" />
        },
        ...components,
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
