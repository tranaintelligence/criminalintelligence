import { authFetch } from './trana-auth';
import { API_URL } from './trana-backend';

export interface AdminAccess {
  authorized: boolean;
  email?: string;
}

export interface AdminKey {
  id: string;
  label: string;
  provider: string;
  model: string;
  mode: 'quick' | 'deep' | string;
  baseUrl?: string | null;
  maskedKey: string;
  active: boolean;
  rotationOrder: number;
  status?: string | null;
  lastUsedAt?: string | null;
  lastError?: string | null;
  createdAt?: string | null;
}

export interface UsageBucket {
  total: number;
  success: number;
  failure: number;
  quota: number;
}

export interface AdminUsageRow {
  keyId: string;
  provider: string;
  model: string;
  mode: string;
  minute: UsageBucket;
  day: UsageBucket;
}

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

const getErrorMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail !== null && 'message' in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

const request = async <T>(credential: string, path: string, init?: RequestInit): Promise<T> => {
  const response = await authFetch(`${API_URL}${path}`, credential, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AdminApiError(
      getErrorMessage(payload, `Admin request failed: ${response.status}`),
      response.status,
    );
  }
  return payload as T;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
);

const firstString = (record: Record<string, unknown>, keys: string[], fallback = ''): string => {
  for (const key of keys) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  return fallback;
};

const firstNumber = (record: Record<string, unknown>, keys: string[], fallback = 0): number => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
};

const firstBoolean = (record: Record<string, unknown>, keys: string[], fallback = false): boolean => {
  for (const key of keys) {
    if (typeof record[key] === 'boolean') return record[key] as boolean;
  }
  return fallback;
};

const listFromPayload = (payload: unknown, keys: string[]): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

export const getAdminAccess = async (credential: string): Promise<AdminAccess> => {
  const payload = await request<unknown>(credential, '/api/admin/access');
  const record = asRecord(payload);
  return {
    authorized: firstBoolean(record, ['authorized', 'is_authorized', 'is_admin', 'allowed']),
    email: firstString(record, ['email', 'user_email'], undefined),
  };
};

export const getAdminKeys = async (credential: string): Promise<AdminKey[]> => {
  const payload = await request<unknown>(credential, '/api/admin/keys');
  return listFromPayload(payload, ['keys', 'items', 'data']).map((item, index) => {
    const record = asRecord(item);
    return {
      id: firstString(record, ['id', 'key_id'], String(index)),
      label: firstString(record, ['label', 'name'], `Gemini key ${index + 1}`),
      provider: firstString(record, ['provider'], 'google'),
      model: firstString(record, ['model', 'model_id', 'model_name'], 'gemini-2.5-flash'),
      mode: firstString(record, ['mode'], 'quick'),
      baseUrl: firstString(record, ['base_url', 'baseUrl'], undefined) || null,
      maskedKey: firstString(record, ['masked_key', 'api_key_masked', 'masked', 'key_display'], '••••••••'),
      active: firstBoolean(record, ['active', 'is_active', 'enabled'], true),
      rotationOrder: firstNumber(record, ['rotation_order', 'order', 'priority'], index + 1),
      status: firstString(record, ['status', 'last_status'], undefined) || null,
      lastUsedAt: firstString(record, ['last_used_at', 'last_used', 'updated_at'], undefined) || null,
      lastError: firstString(record, ['last_error_status', 'last_error', 'error'], undefined) || null,
      createdAt: firstString(record, ['created_at'], undefined) || null,
    };
  });
};

const normalizeBucket = (value: unknown, record: Record<string, unknown>, prefix: string): UsageBucket => {
  const nested = asRecord(value);
  return {
    total: firstNumber(nested, ['total', 'total_requests', 'requests', 'count'], firstNumber(record, [`${prefix}_total`, `${prefix}_total_requests`, `${prefix}_requests`, `${prefix}_count`])),
    success: firstNumber(nested, ['success', 'successful', 'successful_requests'], firstNumber(record, [`${prefix}_success`, `${prefix}_successful`, `${prefix}_successful_requests`])),
    failure: firstNumber(nested, ['failure', 'failed', 'failed_requests', 'errors'], firstNumber(record, [`${prefix}_failure`, `${prefix}_failed`, `${prefix}_failed_requests`, `${prefix}_errors`])),
    quota: firstNumber(nested, ['quota', 'quota_failures', 'rate_limited'], firstNumber(record, [`${prefix}_quota`, `${prefix}_quota_failures`, `${prefix}_rate_limited`])),
  };
};

export const getAdminUsage = async (credential: string): Promise<AdminUsageRow[]> => {
  const payload = await request<unknown>(credential, '/api/admin/usage');
  return listFromPayload(payload, ['rows', 'usage', 'items', 'data']).flatMap((item) => {
    const record = asRecord(item);
    const keyId = firstString(record, ['key_id', 'api_key_id', 'id']);
    if (!keyId) return [];
    return [{
      keyId,
      provider: firstString(record, ['provider'], 'google'),
      model: firstString(record, ['model', 'model_name'], 'unknown'),
      mode: firstString(record, ['mode'], 'quick'),
      minute: normalizeBucket(record.minute, record, 'minute'),
      day: normalizeBucket(record.day, record, 'day'),
    }];
  });
};

export const createAdminKey = (
  credential: string,
  input: {
    label: string;
    api_key: string;
    provider: string;
    model: string;
    mode: string;
    base_url?: string;
    rotation_order: number;
  },
) =>
  request<unknown>(credential, '/api/admin/keys', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateAdminKey = (
  credential: string,
  keyId: string,
  input: { active?: boolean; rotation_order?: number },
) =>
  request<unknown>(credential, `/api/admin/keys/${encodeURIComponent(keyId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.active === undefined ? {} : { is_active: input.active }),
      ...(input.rotation_order === undefined ? {} : { rotation_order: input.rotation_order }),
    }),
  });

export const deleteAdminKey = (credential: string, keyId: string) =>
  request<unknown>(credential, `/api/admin/keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' });


export interface AdminIP {
  id: string;
  ip_address: string;
  description?: string | null;
  created_at?: string;
}

export const getAdminClientIP = async (): Promise<string> => {
  try {
    const res = await fetch(API_URL + '/api/admin/client-ip');
    if (res.ok) {
      const data = (await res.json()) as { client_ip?: string };
      return data.client_ip || '';
    }
  } catch {
    // ignore
  }
  return '';
};

export const getAdminIPs = (credential: string): Promise<AdminIP[]> =>
  request<AdminIP[]>(credential, '/api/admin/ips');

export const createAdminIP = (
  credential: string,
  input: { ip_address: string; description?: string },
): Promise<AdminIP> =>
  request<AdminIP>(credential, '/api/admin/ips', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteAdminIP = (credential: string, ipId: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>(credential, '/api/admin/ips/' + encodeURIComponent(ipId), {
    method: 'DELETE',
  });


export interface AdminOverviewStats {
  total_users: number;
  total_chats: number;
  total_messages: number;
  total_attachments: number;
  active_users_30d: number;
  active_keys: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  created_at?: string | null;
  total_chats: number;
  total_messages: number;
  last_active_at?: string | null;
  status: 'Active' | 'Inactive';
  city?: string | null;
  userType?: 'Citizen' | 'Lawyer' | 'Law Student' | string;
}

export interface AdminUserStats {
  total_chats: number;
  total_messages: number;
  user_messages_count: number;
  assistant_messages_count: number;
  total_attachments: number;
  avg_messages_per_chat: number;
  avg_response_time_seconds: number;
  models_used: Record<string, number>;
  first_active_at?: string | null;
  last_active_at?: string | null;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  created_at?: string | null;
  status: 'Active' | 'Inactive';
  stats: AdminUserStats;
}

export interface AdminChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured_content?: any;
  sources?: any;
  model_used?: string | null;
  processing_time_seconds?: number | null;
  created_at?: string | null;
}

export interface AdminChatAttachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at?: string | null;
}

export interface AdminUserChatSession {
  id: string;
  title: string;
  user_email: string;
  created_at: string;
  updated_at: string;
  deleted_by_user?: boolean;
  deleted_at?: string | null;
  message_count: number;
  messages: AdminChatMessage[];
  attachments?: AdminChatAttachment[];
}

export const getAdminOverviewStats = (credential: string): Promise<AdminOverviewStats> =>
  request<AdminOverviewStats>(credential, '/api/admin/overview-stats');

export const getAdminUsers = (credential: string): Promise<AdminUser[]> =>
  request<AdminUser[]>(credential, '/api/admin/users');

export const getAdminUserDetail = (credential: string, userIdentifier: string): Promise<AdminUserDetail> =>
  request<AdminUserDetail>(credential, `/api/admin/users/${encodeURIComponent(userIdentifier)}`);

export const getAdminUserChats = (credential: string, userIdentifier: string): Promise<AdminUserChatSession[]> =>
  request<AdminUserChatSession[]>(credential, `/api/admin/users/${encodeURIComponent(userIdentifier)}/chats`);


// =============================================================================
// Court Data & eCourts API Management
// =============================================================================

export interface CourtAPIKey {
  id: string;
  provider: string;
  label: string;
  masked_key: string;
  base_url?: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export interface CourtAPIStatus {
  has_active_key: boolean;
  active_provider: string | null;
  key_count: number;
}

export const getCourtKeys = (credential: string): Promise<CourtAPIKey[]> =>
  request<CourtAPIKey[]>(credential, '/api/admin/court-keys');

export const createCourtKey = (
  credential: string,
  data: { provider: string; label: string; api_key: string; base_url?: string; is_active?: boolean }
): Promise<CourtAPIKey> =>
  request<CourtAPIKey>(credential, '/api/admin/court-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCourtKey = (
  credential: string,
  keyId: string,
  data: { label?: string; is_active?: boolean; base_url?: string }
): Promise<CourtAPIKey> =>
  request<CourtAPIKey>(credential, `/api/admin/court-keys/${encodeURIComponent(keyId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteCourtKey = (credential: string, keyId: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>(credential, `/api/admin/court-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });

export const getCourtAPIStatus = (credential: string): Promise<CourtAPIStatus> =>
  request<CourtAPIStatus>(credential, '/api/admin/court-keys/status');

export const testCourtCnrLookup = (
  credential: string,
  cnr: string
): Promise<any> =>
  request<any>(credential, '/api/cases/lookup', {
    method: 'POST',
    body: JSON.stringify({ cnr }),
  });


// =============================================================================
// Notification Providers Gateway (Email & SMS)
// =============================================================================

export interface NotificationProvider {
  id: string;
  channel: 'email' | 'sms';
  provider: 'resend' | 'smtp' | 'twilio' | 'fast2sms' | string;
  label: string;
  masked_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export interface NotificationStatus {
  has_active_email: boolean;
  active_email_provider: string | null;
  has_active_sms: boolean;
  active_sms_provider: string | null;
}

export const getNotificationProviders = (credential: string): Promise<NotificationProvider[]> =>
  request<NotificationProvider[]>(credential, '/api/admin/notification-providers');

export const createNotificationProvider = (
  credential: string,
  data: { channel: string; provider: string; label: string; config: Record<string, any> }
): Promise<NotificationProvider> =>
  request<NotificationProvider>(credential, '/api/admin/notification-providers', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateNotificationProvider = (
  credential: string,
  providerId: string,
  data: { label?: string; is_active?: boolean; config?: Record<string, any> }
): Promise<NotificationProvider> =>
  request<NotificationProvider>(credential, `/api/admin/notification-providers/${encodeURIComponent(providerId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteNotificationProvider = (
  credential: string,
  providerId: string
): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>(credential, `/api/admin/notification-providers/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
  });

export const getNotificationStatus = (credential: string): Promise<NotificationStatus> =>
  request<NotificationStatus>(credential, '/api/admin/notification-providers/status');


// =============================================================================
// Verified Legal Professionals & Bar Verification
// =============================================================================

export interface LawyerRecord {
  id: string;
  user_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  bar_reg_no?: string | null;
  state_bar_council?: string | null;
  year_of_enrollment?: number | null;
  aibe_cop_number?: string | null;
  bar_association?: string | null;
  specialisation: string;
  experience_years: number;
  city: string;
  state?: string | null;
  chamber_address?: string | null;
  courts?: string[] | null;
  bio?: string | null;
  sanad_document_url?: string | null;
  id_card_document_url?: string | null;
  offers_call: boolean;
  offers_chat: boolean;
  offers_in_person: boolean;
  consultation_fee: number;
  approved: boolean;
  verification_status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  verification_notes?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  internal_rating: number;
  clients_referred: number;
  consultations_count: number;
  created_at: string;
  updated_at: string;
}

export interface LawyerRegisterPayload {
  full_name: string;
  email: string;
  phone: string;
  bar_reg_no: string;
  state_bar_council: string;
  year_of_enrollment: number;
  aibe_cop_number?: string | null;
  bar_association?: string | null;
  specialisation: string;
  experience_years: number;
  city: string;
  state?: string | null;
  chamber_address?: string | null;
  courts?: string[] | null;
  bio?: string | null;
  offers_call?: boolean;
  offers_chat?: boolean;
  offers_in_person?: boolean;
  consultation_fee?: number;
}

export interface LawyersSummaryResponse {
  total: number;
  verified: number;
  pending: number;
  suspended: number;
  lawyers: LawyerRecord[];
}

export const getPublicLawyers = async (params?: {
  search?: string;
  city?: string;
  specialisation?: string;
}): Promise<LawyerRecord[]> => {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.city) query.set('city', params.city);
  if (params?.specialisation) query.set('specialisation', params.specialisation);
  const qs = query.toString();
  const res = await fetch(`${API_URL}/api/lawyers${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch verified advocates: ${res.statusText}`);
  }
  return res.json();
};

export const registerLawyer = (
  payload: LawyerRegisterPayload,
  credential?: string
): Promise<LawyerRecord> =>
  request<LawyerRecord>(credential || '', '/api/lawyers/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getCurrentLawyer = (credential: string): Promise<LawyerRecord> =>
  request<LawyerRecord>(credential, '/api/lawyers/me');

export const updateCurrentLawyer = (
  credential: string,
  data: Partial<LawyerRegisterPayload>
): Promise<LawyerRecord> =>
  request<LawyerRecord>(credential, '/api/lawyers/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getAdminLawyers = (
  credential: string,
  params?: { status?: string; search?: string }
): Promise<LawyersSummaryResponse> => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return request<LawyersSummaryResponse>(credential, `/api/admin/lawyers${qs ? `?${qs}` : ''}`);
};

export const verifyLawyerAdmin = (
  credential: string,
  id: string,
  data: { action: 'VERIFY' | 'REJECT' | 'SUSPEND'; notes?: string; internal_rating?: number }
): Promise<LawyerRecord> =>
  request<LawyerRecord>(credential, `/api/admin/lawyers/${encodeURIComponent(id)}/verify`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteLawyerAdmin = (
  credential: string,
  id: string
): Promise<{ ok: boolean; message: string }> =>
  request<{ ok: boolean; message: string }>(credential, `/api/admin/lawyers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export const testLawyerVerification = (
  credential: string,
  payload: {
    bar_reg_no: string;
    full_name: string;
    state_bar_council?: string;
    year_of_enrollment?: number;
    aibe_cop_number?: string;
  }
): Promise<any> =>
  request<any>(credential, '/api/admin/lawyers/test-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const autoVerifyLawyerAdmin = (
  credential: string,
  id: string
): Promise<LawyerRecord> =>
  request<LawyerRecord>(credential, `/api/admin/lawyers/${encodeURIComponent(id)}/auto-verify`, {
    method: 'POST',
  });

export interface FounderRecord {
  id: string;
  email: string;
  label: string | null;
  added_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getFounderEmails = (credential: string): Promise<FounderRecord[]> =>
  request<FounderRecord[]>(credential, '/api/admin/founders');

export const addFounderEmail = (
  credential: string,
  payload: { email: string; label?: string }
): Promise<FounderRecord> =>
  request<FounderRecord>(credential, '/api/admin/founders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteFounderEmail = (
  credential: string,
  id: string
): Promise<{ ok: boolean; message: string }> =>
  request<{ ok: boolean; message: string }>(credential, `/api/admin/founders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
