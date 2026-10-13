'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="bottom-right"
      duration={5000}
      className="toaster group !font-sans"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-elevated group-[.toaster]:text-foreground'
            + ' group-[.toaster]:border-border group-[.toaster]:shadow-lg'
            + ' group-[.toaster]:text-sm',
          title: 'group-[.toast]:!text-sm group-[.toast]:!font-bold',
          description:
            'group-[.toast]:!text-sm group-[.toast]:text-muted-foreground',
          success:
            'group-[.toaster]:!bg-success-solid group-[.toaster]:!text-white'
            + ' group-[.toaster]:!border-success-solid'
            + ' [&_[data-description]]:!text-white/85'
            + ' [&_[data-icon]]:!text-white'
            + ' [&_[data-button]]:!text-success-solid',
          error:
            'group-[.toaster]:!bg-destructive-solid group-[.toaster]:!text-white'
            + ' group-[.toaster]:!border-destructive-solid'
            + ' [&_[data-description]]:!text-white/85'
            + ' [&_[data-icon]]:!text-white'
            + ' [&_[data-button]]:!text-destructive-solid',
          actionButton:
            'group-[.toast]:!bg-white group-[.toast]:min-h-11'
            + ' group-[.toast]:px-4 group-[.toast]:font-bold',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
