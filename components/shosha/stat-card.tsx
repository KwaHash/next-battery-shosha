import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * 数字1つを大きく出すカード。増減は「良くなったか」で色を決める
 * （対応時間は減るほど良い）。前の期間が0件なら増減は出さない。
 */
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  iconClassName,
  change,
  betterWhen = 'up',
  changeLabel = '前の7日から',
  changeUnit = '%',
  sub,
  tooltip,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  /** アイコンの色。系列やステータスとは無関係な、カードの見分け用 */
  iconClassName: string;
  change?: number | null;
  betterWhen?: 'up' | 'down';
  changeLabel?: string;
  /** 率の増減はポイント（pt）で出す */
  changeUnit?: '%' | 'pt';
  sub?: React.ReactNode;
  tooltip?: string;
}) {
  const hasChange = typeof change === 'number'
  const up = hasChange && change >= 0
  const good = hasChange && (change === 0 || (betterWhen === 'up' ? up : !up))
  const ChangeIcon = up ? ArrowUpRight : ArrowDownRight

  return (
    <Card className="transition-colors hover:bg-muted/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              {tooltip ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label={`${label}の説明`} className="ml-1">
                        <Info className="size-3.5 text-muted-foreground" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {typeof value === 'number' ? value.toLocaleString('ja-JP') : value}
              {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
            </p>
            <div className="mt-2 flex min-h-4 items-center text-xs">
              {hasChange ? (
                <>
                  <ChangeIcon
                    className={cn('mr-1 size-3', good ? 'text-success' : 'text-destructive')}
                    aria-hidden
                  />
                  <span className={good ? 'text-success' : 'text-destructive'}>
                    {Math.abs(change).toFixed(1)}{changeUnit}
                  </span>
                  <span className="ml-1 text-muted-foreground">{changeLabel}</span>
                </>
              ) : sub ? (
                <span className="text-muted-foreground">{sub}</span>
              ) : (
                <span className="text-muted-foreground">比べる前の期間がありません</span>
              )}
            </div>
          </div>
          <div className={cn('shrink-0 rounded-full bg-muted p-3', iconClassName)}>
            <Icon className="size-6" aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
