import { ShieldAlert } from 'lucide-react'
import { StatusBadge } from '@/components/shosha/status-badge'
import { type Verdict } from '@/types/shosha'

/** 受信箱の判定。保安機器は「人が確認」より強く出す（何があっても人）。 */
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict.safety) {
    return (
      <StatusBadge tone="danger">
        <ShieldAlert className="mr-1 size-3.5" aria-hidden />
        保安機器
      </StatusBadge>
    )
  }
  return verdict.ok ? (
    <StatusBadge tone="ok">自動で返せます</StatusBadge>
  ) : (
    <StatusBadge tone="warn">人が確認</StatusBadge>
  )
}
