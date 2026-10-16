type Timestamps = {
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

type Table<
  Row extends { id: string | number },
  Rel extends readonly unknown[] = [],
> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Rel;
}

export type TenantRow = {
  id: string;
  name: string;
  created_at: string;
}

export type MembershipRow = {
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'manager' | 'member';
  created_at: string;
}

export type SiteRow = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string;
  address: string | null;
  owner_name: string | null;
  contact: string | null;
  note: string | null;
  building_type: string | null;
  receive_note: string | null;
  today: boolean;
  today_state: 'NONE' | 'ARRIVED' | 'WORKING' | 'DONE';
} & Timestamps

export type ProductRow = {
  id: string;
  tenant_id: string;
  maker: string;
  model: string;
  name: string;
  category: string | null;
  unit_price: number;
  stock: number;
  lead_days: number;
  successor_of: string | null;
  verified: boolean;
  note: string | null;
} & Timestamps

export type RequestRow = {
  id: string;
  tenant_id: string;
  site_id: string | null;
  kind: 'QUOTE' | 'ORDER';
  status: 'DRAFT' | 'PENDING' | 'SENT' | 'ANSWERED' | 'ORDERED';
  channel: 'WEB' | 'LINE' | 'PHONE' | 'FAX' | 'MAIL';
  from_company: string | null;
  from_person: string | null;
  photo_name: string | null;
  need_by: string | null;
  note: string | null;
  answer_by: string | null;
  answer_at: string | null;
  answer_text: string | null;
  answer_mode: 'AUTO' | 'HUMAN' | null;
  answer_reasons: string[] | null;
  alternatives: string[] | null;
  delivery_promised: string | null;
  delivery_changed_to: string | null;
  delivery_reason: string | null;
  delivery_notified_at: string | null;
  delivery_seen: boolean;
  ordered_at: string | null;
  idempotency_key: string | null;
} & Timestamps

export type RequestItemRow = {
  id: string;
  tenant_id: string;
  request_id: string;
  product_id: string | null;
  maker: string;
  model: string;
  name: string;
  category: string | null;
  qty: number;
  unit_price: number;
  stock: number;
  lead_days: number;
  verified: boolean;
  position: number;
  created_at: string;
}

export type PhotoRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  kind: 'BEFORE' | 'AFTER' | 'DEFECT';
  area: string;
  name: string | null;
  storage_path: string | null;
  note: string | null;
  taken_at: string;
  taken_by: string | null;
  exif_stripped: boolean;
} & Timestamps

export type CalendarEventRow = {
  id: string;
  tenant_id: string;
  site_id: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  kind: 'WORK' | 'SURVEY' | 'OTHER';
  source: 'GOOGLE' | 'MANUAL';
  members: string | null;
} & Timestamps

export type TodoRow = {
  id: string;
  tenant_id: string;
  site_id: string | null;
  title: string;
  due: string | null;
  kind: 'MANUAL' | 'PHOTO' | 'MATERIAL' | 'DOC';
  done: boolean;
  done_at: string | null;
  auto: boolean;
  dedupe_key: string | null;
} & Timestamps

export type Reminder = {
  key: string;
  label: string;
  note: string;
  on: boolean;
  locked?: boolean;
}

export type SettingsRow = {
  id: string;
  tenant_id: string;
  calendar_linked: boolean;
  calendar_name: string | null;
  last_sync: string | null;
  reminders: Reminder[];
  created_at: string;
  updated_at: string;
}

export type HelpRequestRow = {
  id: string;
  tenant_id: string;
  site_id: string | null;
  title: string;
  level: 'RED' | 'YELLOW' | 'GREEN';
  qual_label: string | null;
  unit: string | null;
  price: number;
  hours: string | null;
  note: string | null;
  status: 'OPEN' | 'MATCHED' | 'CLOSED';
} & Timestamps

export type CompanyRow = {
  id: string;
  tenant_id: string;
  name: string;
  user_name: string | null;
  role: string | null;
} & Timestamps

export type AuditEventRow = {
  id: number;
  tenant_id: string;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  denied: boolean;
  reasons: string[] | null;
  created_at: string;
}

// ---- ここから受付アシスト（商社側）が追加したテーブル ----
// supabase/migrations/20261012000000_shosha.sql

export type StaffRole = 'RECEPTION' | 'TECHNICAL' | 'ADMIN'

export type ShoshaStaffRow = {
  user_id: string;
  tenant_id: string;
  display_name: string;
  role: StaffRole;
  created_at: string;
  archived_at: string | null;
}

export type ModelAliasRow = {
  id: string;
  tenant_id: string;
  from_model: string;
  to_model: string;
  reason: string | null;
  created_by: string | null;
  request_id: string | null;
} & Timestamps

export type AnswerLogRow = {
  id: string;
  tenant_id: string;
  request_id: string;
  model: string;
  channel: RequestRow['channel'] | null;
  mode: 'AUTO' | 'HUMAN';
  approved_by_human: boolean;
  edited: boolean;
  minutes: number | null;
  answered_by: string | null;
  created_at: string;
}

export type RequestOpenRow = {
  request_id: string;
  tenant_id: string;
  opened_by: string | null;
  opened_at: string;
}

export type Database = {
  public: {
    Tables: {
      tenants: Table<TenantRow>;
      memberships: {
        Row: MembershipRow;
        Insert: Partial<MembershipRow>;
        Update: Partial<MembershipRow>;
        Relationships: [];
      };
      companies: Table<CompanyRow>;
      sites: Table<SiteRow>;
      products: Table<ProductRow>;
      requests: Table<RequestRow>;
      request_items: Table<
        RequestItemRow,
        [
          {
            foreignKeyName: 'request_items_request_id_fkey';
            columns: ['request_id'];
            isOneToOne: false;
            referencedRelation: 'requests';
            referencedColumns: ['id'];
          },
        ]
      >;
      photos: Table<PhotoRow>;
      calendar_events: Table<CalendarEventRow>;
      todos: Table<TodoRow>;
      settings: Table<SettingsRow>;
      help_requests: Table<HelpRequestRow>;
      audit_events: Table<AuditEventRow>;
      shosha_staff: {
        Row: ShoshaStaffRow;
        Insert: Partial<ShoshaStaffRow>;
        Update: Partial<ShoshaStaffRow>;
        Relationships: [];
      };
      model_aliases: Table<ModelAliasRow>;
      answer_logs: Table<AnswerLogRow>;
      request_opens: {
        Row: RequestOpenRow;
        Insert: Partial<RequestOpenRow>;
        Update: Partial<RequestOpenRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      auth_tenant_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      auth_shosha_tenant_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
