import { type RequestRow, type StaffRole } from '@/types/database'

export type Tone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info'

/** 商社側から見た呼び方。現場側（genba）の「依頼中／回答あり」とは視点が逆になる。 */
export const INQUIRY_STATUS_LABEL: Record<RequestRow['status'], string> = {
  DRAFT: '下書き',
  PENDING: '送信待ち',
  SENT: '未回答',
  ANSWERED: '回答済',
  ORDERED: '受注',
}

export const INQUIRY_STATUS_TONE: Record<RequestRow['status'], Tone> = {
  DRAFT: 'neutral',
  PENDING: 'neutral',
  SENT: 'warn',
  ANSWERED: 'ok',
  ORDERED: 'info',
}

export const CHANNEL_LABEL: Record<RequestRow['channel'], string> = {
  WEB: 'アプリ',
  LINE: 'LINE',
  PHONE: '電話',
  FAX: 'FAX',
  MAIL: 'メール',
}

/** 電話・FAXで受けた分を起票するときに選べる経路。アプリ・LINEは自動で1件になる。 */
export const INTAKE_CHANNELS = ['PHONE', 'FAX', 'MAIL'] as const
export type IntakeChannel = (typeof INTAKE_CHANNELS)[number]

export const ANSWER_MODE_LABEL: Record<NonNullable<RequestRow['answer_mode']>, string> = {
  AUTO: '自動回答',
  HUMAN: '担当者',
}

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  RECEPTION: '受付',
  TECHNICAL: '技術確認',
  ADMIN: '管理',
}
