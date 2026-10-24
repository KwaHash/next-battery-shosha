import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = '戻る',
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          {backTo ? (
            <Link
              href={backTo}
              className="-ml-1 mb-0.5 inline-flex items-center gap-0.5 text-sm font-semibold text-primary"
            >
              <ChevronLeft className="size-4" aria-hidden />
              {backLabel}
            </Link>
          ) : null}
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 lg:p-6">
      {children}
    </div>
  )
}
