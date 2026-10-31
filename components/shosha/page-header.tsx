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
    <header className="px-4 pb-2 pt-8 lg:px-8 lg:pt-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {backTo ? (
            <Link
              href={backTo}
              className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden />
              {backLabel}
            </Link>
          ) : null}
          <h1 className="truncate text-3xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-2 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  )
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-12 pt-6 lg:px-8">
      {children}
    </div>
  )
}
