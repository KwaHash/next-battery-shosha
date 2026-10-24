/**
 * CSV の書き出し。Excel でそのまま開ける形（BOM付き UTF-8・CRLF）。
 *
 * 「溜めるのはDB、見せるのはシート」（docs/25）。ここは見せるための出口で、
 * シートの側を正にしない。
 */

export type CsvCell = string | number | boolean | null | undefined

/**
 * 依頼元の会社名やメモは外から入ってくる。`=` などで始まる値は Excel が式として
 * 実行するので、先頭に `'` を付けて文字として扱わせる。
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'string' ? value : String(value)
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}
