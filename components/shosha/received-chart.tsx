'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatDate, weekdayOf } from '@/lib/domain/clock'
import { type DayPoint } from '@/lib/domain/dashboard'
import { cn } from '@/lib/utils'

/**
 * 日ごとの受信件数と自動回答の件数（同じ「件」の軸。2軸にはしない）。
 * 系列色は --chart-1 / --chart-2（validate_palette.js で黒地・白地とも確認済み）。
 */

const SERIES = [
  { key: 'received', label: '受信', color: 'hsl(var(--chart-1))', glow: true },
  { key: 'auto', label: '自動回答', color: 'hsl(var(--chart-2))', glow: false },
] as const

const HEIGHT = 260
const PAD = { top: 16, right: 76, bottom: 28, left: 36 }

/** 0 から始まる、きりのよい目盛り。件数なので整数。 */
function niceTicks(max: number): number[] {
  const top = Math.max(4, max)
  const step = Math.max(1, Math.ceil(top / 4))
  return [0, 1, 2, 3, 4].map((i) => i * step)
}

function linePath(points: { x: number; y: number }[]): string {
  if (!points.length) return ''
  // 単調な3次曲線。値の山を越えて行き過ぎない（0件が負に見えない）。
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]
    const p1 = points[i]
    const mx = (p0.x + p1.x) / 2
    d += ` C${mx},${p0.y} ${mx},${p1.y} ${p1.x},${p1.y}`
  }
  return d
}

export function ReceivedChart({ data, today }: { data: DayPoint[]; today: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const glowId = useId().replace(/:/g, '')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const ticks = useMemo(
    () => niceTicks(Math.max(...data.map((d) => Math.max(d.received, d.auto)), 0)),
    [data],
  )
  const yMax = ticks[ticks.length - 1]
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom

  const x = (i: number) => PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH

  const lines = SERIES.map((s) => ({
    ...s,
    points: data.map((d, i) => ({ x: x(i), y: y(d[s.key]) })),
  }))

  function pick(clientX: number) {
    const el = wrapRef.current
    if (!el || !data.length) return
    const left = el.getBoundingClientRect().left
    const ratio = (clientX - left - PAD.left) / (plotW || 1)
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))))
  }

  function onKey(event: React.KeyboardEvent) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const from = active ?? data.length - 1
      setActive(Math.min(data.length - 1, Math.max(0, from + (event.key === 'ArrowLeft' ? -1 : 1))))
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  const point = active !== null ? data[active] : null
  const last = data.length - 1
  // 日付の目盛りは間引く。14日なら1日おき、狭ければさらに。
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 56))))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="relative rounded-lg border bg-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[#0A0E17]"
        style={{ height: HEIGHT }}
        tabIndex={0}
        role="img"
        aria-label={`直近${data.length}日の受信件数と自動回答の件数。矢印キーで日を選べます。`}
        onKeyDown={onKey}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
      >
        {width > 0 ? (
          <svg width={width} height={HEIGHT} className="block">
            <defs>
              <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 目盛り線は控えめに */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-border"
                  strokeOpacity={t === 0 ? 1 : 0.5}
                  strokeDasharray={t === 0 ? undefined : '2 4'}
                />
                <text
                  x={PAD.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {t}
                </text>
              </g>
            ))}

            {data.map((d, i) =>
              i % labelEvery === (last % labelEvery) || i === last ? (
                <text
                  key={d.date}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className={cn(
                    'text-[11px]',
                    d.date === today ? 'fill-foreground font-bold' : 'fill-muted-foreground',
                  )}
                >
                  {d.date === today ? '今日' : `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`}
                </text>
              ) : null,
            )}

            {/* 選んだ日の縦線 */}
            {active !== null ? (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className="stroke-muted-foreground"
                strokeOpacity={0.6}
              />
            ) : null}

            {lines.map((s) => (
              <path
                key={s.key}
                d={linePath(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={s.glow ? `url(#${glowId})` : undefined}
              />
            ))}

            {/* 今日の点と、末尾の直接ラベル */}
            {lines.map((s) => {
              const p = s.points[last]
              if (!p) return null
              return (
                <g key={s.key}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={s.color}
                    className="stroke-background"
                    strokeWidth={2}
                    filter={s.glow ? `url(#${glowId})` : undefined}
                  />
                  <text
                    x={p.x + 10}
                    y={p.y}
                    dy={s.key === 'auto' && Math.abs(p.y - lines[0].points[last].y) < 14 ? '1.2em' : '0.32em'}
                    className="fill-muted-foreground text-[11px]"
                  >
                    {s.label} {data[last][s.key]}
                  </text>
                </g>
              )
            })}

            {active !== null
              ? lines.map((s) => (
                <circle
                  key={s.key}
                  cx={s.points[active].x}
                  cy={s.points[active].y}
                  r={4}
                  fill={s.color}
                  className="stroke-background"
                  strokeWidth={2}
                />
              ))
              : null}
          </svg>
        ) : null}

        {point && active !== null ? (
          <div
            className="pointer-events-none absolute top-3 z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
            style={
              x(active) > width / 2
                ? { right: width - x(active) + 12 }
                : { left: x(active) + 12 }
            }
          >
            <p className="mb-1 text-xs text-muted-foreground">
              {formatDate(point.date)}
              {point.date === today ? '・今日' : ''}
            </p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="font-bold tabular-nums">{point[s.key]}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </p>
            ))}
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {point ? `${formatDate(point.date)} 受信 ${point.received} 件、自動回答 ${point.auto} 件` : ''}
        </p>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">表で見る</summary>
        <div className="mt-2 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">日付</th>
                <th className="px-3 py-2 text-right font-semibold">受信</th>
                <th className="px-3 py-2 text-right font-semibold">自動回答</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5">
                    {Number(d.date.slice(5, 7))}月{Number(d.date.slice(8))}日（{weekdayOf(d.date)}）
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.received}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.auto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
