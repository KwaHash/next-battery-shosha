import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type NoticeVariant = 'info' | 'success' | 'warning' | 'destructive'

export function Notice({
  variant = 'info',
  title,
  lines = [],
}: {
  variant?: NoticeVariant;
  title: string;
  lines?: string[];
}) {
  return (
    <Alert variant={variant}>
      <AlertTitle className={lines.length ? 'mb-2' : 'mb-0'}>{title}</AlertTitle>
      {lines.length ? (
        <AlertDescription>
          <ul className="list-disc space-y-0.5 pl-4">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </AlertDescription>
      ) : null}
    </Alert>
  )
}
