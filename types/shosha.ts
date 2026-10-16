import {
  type AnswerLogRow,
  type ModelAliasRow,
  type ProductRow,
  type RequestItemRow,
  type RequestRow,
  type SiteRow,
} from '@/types/database'

export type InquiryWithItems = RequestRow & {
  items: RequestItemRow[];
}

/** 判定の結果。画面にそのまま出す。 */
export type Verdict = {
  ok: boolean;
  safety: boolean;
  reasons: string[];
  blockers: string[];
}

export type InboxRow = {
  id: string;
  tenantName: string;
  status: RequestRow['status'];
  channel: RequestRow['channel'];
  from: string;
  person: string | null;
  maker: string;
  model: string;
  name: string;
  qty: number;
  amount: number;
  needBy: string | null;
  createdAt: string;
  answerMode: RequestRow['answer_mode'];
  answerAt: string | null;
  deliveryChanged: boolean;
  deliverySeen: boolean;
  verdict: Verdict | null;
}

export type Inbox = {
  open: InboxRow[];
  done: InboxRow[];
}

export type ModelHistoryEntry = {
  requestId: string;
  from: string;
  qty: number;
  answerMode: RequestRow['answer_mode'];
  answerBy: string | null;
  answerAt: string | null;
  answerText: string | null;
}

export type InquiryDetail = {
  inquiry: InquiryWithItems;
  item: RequestItemRow;
  tenantName: string;
  from: string;
  site: SiteRow | null;
  verdict: Verdict;
  /** 定型の下書き（現場着の行は画面で足す） */
  draft: string;
  aliases: ModelAliasRow[];
  products: ProductRow[];
  history: ModelHistoryEntry[];
  humanApprovals: number;
  log: AnswerLogRow | null;
  openedAt: string | null;
  today: string;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; reasons: string[] }
