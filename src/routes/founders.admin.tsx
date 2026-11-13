import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle,
  Check,
  Clock3,
  KeyRound,
  LockKeyhole,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
  Globe,
  Plus,
  Network,
  Download,
  Scale,
  Landmark,
  Award,
  ExternalLink,
  Search,
  Bell,
  Mail,
  Smartphone,
  Send,
} from 'lucide-react';
import { useTranaCredential } from '@/lib/trana-auth';
import { downloadCSV } from '@/lib/csv-export';
import {
  AdminApiError,
  createAdminKey,
  deleteAdminKey,
  getAdminAccess,
  getAdminKeys,
  getAdminUsage,
  updateAdminKey,
  getAdminIPs,
  getAdminClientIP,
  createAdminIP,
  deleteAdminIP,
  getCourtKeys,
  createCourtKey,
  updateCourtKey,
  deleteCourtKey,
  getCourtAPIStatus,
  testCourtCnrLookup,
  testLawyerVerification,
  getNotificationProviders,
  createNotificationProvider,
  updateNotificationProvider,
  deleteNotificationProvider,
  getNotificationStatus,
} from '@/lib/trana-admin-api';
import { ALL_STATE_BAR_COUNCILS } from '@/lib/courts-data';
import type { AdminKey, AdminUsageRow, UsageBucket, AdminIP, CourtAPIKey, CourtAPIStatus, NotificationProvider, NotificationStatus } from '@/lib/trana-admin-api';
import { API_URL } from '@/lib/trana-backend';

export const Route = createFileRoute('/founders/admin')({
  head: () => ({
    meta: [
      { title: 'Founders Dashboard — TRANA' },
      { name: 'description', content: 'Manage provider rotation and monitor Quick Thinking capacity.' },
      { property: 'og:title', content: 'Founders Dashboard — TRANA' },
    ],
  }),
  component: AdminView,
});

type AccessState = 'checking' | 'authorized' | 'unauthenticated' | 'forbidden' | 'error';

interface KeyFormState {
  label: string;
  apiKey: string;
  provider: string;
  model: string;
  mode: 'quick';
  baseUrl: string;
  rotationOrder: string;
}

const EMPTY_BUCKET: UsageBucket = { total: 0, success: 0, failure: 0, quota: 0 };

const formatIst = (value?: string | null): string => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return (
    new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(date) + ' IST'
  );
};

const getErrorText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const Counter = ({ label, value }: { label: string; value: number }) => (
  <div className="admin-counter flex flex-col bg-[#141414] border border-[#222222] rounded-xl p-3">
    <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-mono">{label}</span>
    <strong className="text-base font-semibold text-neutral-100 mt-1">{value.toLocaleString('en-IN')}</strong>
  </div>
);

const UsageCard = ({ label, bucket }: { label: string; bucket: UsageBucket }) => (
  <div className="admin-usage-model bg-[#161616] border border-[#262626] rounded-xl p-4 mb-3">
    <div className="admin-usage-model__heading flex items-center justify-between mb-3">
      <span className="font-mono text-xs text-amber-200/90 font-medium truncate max-w-[200px]">{label}</span>
      <span className="admin-usage-model__total text-xs text-neutral-400 font-mono">
        {bucket.total.toLocaleString('en-IN')} requests
      </span>
    </div>
    <div className="admin-counter-grid grid grid-cols-3 gap-2">
      <Counter label="Success" value={bucket.success} />
      <Counter label="Failed" value={bucket.failure} />
      <Counter label="Quota" value={bucket.quota} />
    </div>
  </div>
);

const AdminKeyRow: React.FC<{
  keyRecord: AdminKey;
  rotationDraft: string;
  isSaving: boolean;
  onRotationChange: (value: string) => void;
  onRotationBlur: () => void;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ keyRecord, rotationDraft, isSaving, onRotationChange, onRotationBlur, onToggle, onDelete }) => (
  <div className="admin-key-row flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-[#141414] border border-[#242424] rounded-xl hover:border-[#333333] transition-colors">
    <div className="admin-key-row__identity flex items-center gap-3 min-w-0">
      <div className="admin-key-icon shrink-0 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] flex items-center justify-center text-amber-200/90">
        <KeyRound size={17} />
      </div>
      <div className="min-w-0">
        <div className="admin-key-label font-medium text-sm text-neutral-100 truncate">{keyRecord.label}</div>
        <div className="admin-key-mask font-mono text-xs text-neutral-400 truncate mt-0.5">
          {keyRecord.provider} · {keyRecord.model} · {keyRecord.maskedKey}
        </div>
      </div>
    </div>

    <div className="admin-key-row__meta flex flex-wrap items-center gap-3">
      <label className="admin-field admin-field--compact flex items-center gap-1.5 text-xs text-neutral-400">
        <span>Order</span>
        <input
          type="number"
          min="1"
          value={rotationDraft}
          onChange={(event) => onRotationChange(event.target.value)}
          onBlur={onRotationBlur}
          disabled={isSaving}
          aria-label={`Rotation order for ${keyRecord.label}`}
          className="w-14 bg-[#1c1c1c] border border-[#303030] rounded-lg px-2 py-1 text-center font-mono text-neutral-200 text-xs focus:outline-none focus:border-amber-400"
        />
      </label>

      <span
        className={`admin-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
          keyRecord.active
            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
        }`}
      >
        <span
          className={`admin-status-dot w-1.5 h-1.5 rounded-full ${keyRecord.active ? 'bg-emerald-400' : 'bg-neutral-500'}`}
        />
        {keyRecord.active ? 'Active' : 'Inactive'}
      </span>

      <span className="admin-key-last-used inline-flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
        <Clock3 size={13} /> {formatIst(keyRecord.lastUsedAt)}
      </span>
    </div>

    <div className="admin-key-row__actions flex items-center gap-2">
      <button
        type="button"
        className={`admin-icon-button p-2 rounded-lg border transition-colors ${
          keyRecord.active
            ? 'bg-[#1a1a1a] border-[#2e2e2e] text-neutral-300 hover:text-amber-400'
            : 'bg-[#181818] border-[#262626] text-neutral-500 hover:text-emerald-400'
        }`}
        onClick={onToggle}
        disabled={isSaving}
        title={keyRecord.active ? 'Deactivate key' : 'Activate key'}
      >
        <Power size={15} />
        <span className="sr-only">
          {keyRecord.active ? 'Deactivate' : 'Activate'} {keyRecord.label}
        </span>
      </button>

      <button
        type="button"
        className="admin-icon-button admin-icon-button--danger p-2 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] text-rose-400 hover:bg-rose-950/40 hover:border-rose-900 transition-colors"
        onClick={onDelete}
        disabled={isSaving}
        title="Delete key"
      >
        <Trash2 size={15} />
        <span className="sr-only">Delete {keyRecord.label}</span>
      </button>
    </div>
  </div>
);

export function AdminView() {
  const navigate = useNavigate();
  const { credential, user, loading: authLoading } = useTranaCredential();
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [keys, setKeys] = useState<AdminKey[]>([]);
  const [usage, setUsage] = useState<AdminUsageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<KeyFormState>({
    label: '',
    apiKey: '',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    mode: 'quick',
    baseUrl: '',
    rotationOrder: '1',
  });
  const [isAdding, setIsAdding] = useState(false);
  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);
  const [rotationDrafts, setRotationDrafts] = useState<Record<string, string>>({});

  // IP Management State
  const [adminTab, setAdminTab] = useState<'ips' | 'keys' | 'court' | 'notifications'>('court');
  const [notifProviders, setNotifProviders] = useState<NotificationProvider[]>([]);
  const [notifStatus, setNotifStatus] = useState<NotificationStatus>({
    has_active_email: false,
    active_email_provider: null,
    has_active_sms: false,
    active_sms_provider: null,
  });

  const [notifForm, setNotifForm] = useState({
    channel: 'email' as 'email' | 'sms',
    emailProvider: 'resend' as 'resend' | 'smtp',
    smsProvider: 'fast2sms' as 'fast2sms' | 'twilio',
    label: '',
    resendApiKey: '',
    resendFrom: 'TRANA eCourts <onboarding@resend.dev>',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    smtpFrom: '',
    fast2smsApiKey: '',
    twilioSid: '',
    twilioToken: '',
    twilioFrom: '',
  });

  const [isAddingNotif, setIsAddingNotif] = useState(false);
  const [deletingNotifId, setDeletingNotifId] = useState<string | null>(null);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState<string | null>(null);

  // Test notification dispatch state
  const [testNotifEmail, setTestNotifEmail] = useState('');
  const [testNotifPhone, setTestNotifPhone] = useState('');
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [testNotifResult, setTestNotifResult] = useState<any | null>(null);
  const [courtKeys, setCourtKeys] = useState<CourtAPIKey[]>([]);
  const [courtStatus, setCourtStatus] = useState<CourtAPIStatus>({ has_active_key: false, active_provider: null, key_count: 0 });
  const [courtForm, setCourtForm] = useState({
    provider: 'surepass',
    label: '',
    apiKey: '',
    baseUrl: '',
  });
  const [isAddingCourtKey, setIsAddingCourtKey] = useState(false);
  const [deletingCourtKeyId, setDeletingCourtKeyId] = useState<string | null>(null);
  const [courtSuccessMsg, setCourtSuccessMsg] = useState<string | null>(null);
  const [testCnrInput, setTestCnrInput] = useState('');
  const [testCnrResult, setTestCnrResult] = useState<any | null>(null);
  const [isTestingCnr, setIsTestingCnr] = useState(false);

  // Advocate Verification Test State
  const [testAdvName, setTestAdvName] = useState('Adv. Krish Chauhan');
  const [testAdvBarNo, setTestAdvBarNo] = useState('D/2104/2021');
  const [testAdvCouncil, setTestAdvCouncil] = useState('Bar Council of Delhi (BCD)');
  const [testAdvYear, setTestAdvYear] = useState('2021');
  const [testAdvCop, setTestAdvCop] = useState('COP/2021/08912');
  const [isTestingAdv, setIsTestingAdv] = useState(false);
  const [testAdvResult, setTestAdvResult] = useState<any | null>(null);
  const [ips, setIps] = useState<AdminIP[]>([]);
  const [clientIp, setClientIp] = useState('');
  const [ipAddressInput, setIpAddressInput] = useState('');
  const [ipDescInput, setIpDescInput] = useState('');
  const [isAddingIp, setIsAddingIp] = useState(false);
  const [deletingIpId, setDeletingIpId] = useState<string | null>(null);
  const [ipSuccessMsg, setIpSuccessMsg] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (authLoading) return;
      if (!credential) {
        setAccessState('unauthenticated');
        return;
      }

      setAccessState('checking');
      setError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const access = await getAdminAccess(credential);
        if (!access.authorized) {
          setAccessState('forbidden');
          setKeys([]);
          setUsage([]);
          return;
        }

        const [nextKeys, nextUsage, nextIps, currentIp, nextCourtKeys, nextCourtStatus, nextNotifs, nextNotifStatus] = await Promise.all([
          getAdminKeys(credential).catch((err) => {
            console.warn('Failed to load admin keys:', err);
            return [];
          }),
          getAdminUsage(credential).catch((err) => {
            console.warn('Failed to load admin usage:', err);
            return [];
          }),
          getAdminIPs(credential).catch(() => []),
          getAdminClientIP().catch(() => ''),
          getCourtKeys(credential).catch(() => []),
          getCourtAPIStatus(credential).catch(() => ({ has_active_key: false, active_provider: null, key_count: 0 })),
          getNotificationProviders(credential).catch(() => []),
          getNotificationStatus(credential).catch(() => ({ has_active_email: false, active_email_provider: null, has_active_sms: false, active_sms_provider: null })),
        ]);
        setAccessState('authorized');
        setKeys(nextKeys);
        setUsage(nextUsage);
        setIps(nextIps);
        setClientIp(currentIp);
        setCourtKeys(nextCourtKeys);
        setCourtStatus(nextCourtStatus);
        setNotifProviders(nextNotifs);
        setNotifStatus(nextNotifStatus);
        setRotationDrafts(
          Object.fromEntries(nextKeys.map((keyRecord) => [keyRecord.id, String(keyRecord.rotationOrder)])),
        );
      } catch (loadError) {
        if (loadError instanceof AdminApiError && loadError.status === 401) {
          setAccessState('error');
          setError('Your session has expired. Sign in again to open the admin console.');
        } else if (loadError instanceof AdminApiError && loadError.status === 403) {
          setAccessState('forbidden');
        } else {
          setAccessState('error');
          setError(getErrorText(loadError, 'The admin console could not be loaded.'));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [credential, authLoading],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadDashboard();
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const usageByKey = useMemo(() => {
    const grouped = new Map<string, Map<string, { label: string; minute: UsageBucket; day: UsageBucket }>>();
    usage.forEach((row) => {
      const current =
        grouped.get(row.keyId) ||
        new Map([
          ['__quick__', { label: 'Quick Thinking', minute: { ...EMPTY_BUCKET }, day: { ...EMPTY_BUCKET } }],
        ]);
      current.set(row.model, { label: row.model, minute: row.minute, day: row.day });
      grouped.set(row.keyId, current);
    });
    return grouped;
  }, [usage]);

  const updateKey = async (keyRecord: AdminKey, input: { active?: boolean; rotation_order?: number }) => {
    if (!credential) return;
    setSavingKeyId(keyRecord.id);
    setError(null);
    try {
      await updateAdminKey(credential, keyRecord.id, input);
      await loadDashboard(true);
    } catch (updateError) {
      setError(getErrorText(updateError, 'That key could not be updated.'));
    } finally {
      setSavingKeyId(null);
    }
  };

  const handleAddKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = form.label.trim();
    const apiKey = form.apiKey.trim();
    const rotationOrder = Number(form.rotationOrder);
    if (!label || !apiKey || !Number.isInteger(rotationOrder) || rotationOrder < 1) {
      setFormError('Add a label, API key, and a whole-number rotation order of 1 or higher.');
      return;
    }
    if (!credential) return;

    setFormError(null);
    setError(null);
    setIsAdding(true);
    try {
      await createAdminKey(credential, {
        label,
        api_key: apiKey,
        provider: form.provider,
        model: form.model,
        mode: form.mode,
        ...(form.baseUrl.trim() ? { base_url: form.baseUrl.trim() } : {}),
        rotation_order: rotationOrder,
      });
      setForm({
        label: '',
        apiKey: '',
        provider: form.provider,
        model: form.model,
        mode: form.mode,
        baseUrl: form.baseUrl,
        rotationOrder: String(keys.length + 2),
      });
      await loadDashboard(true);
    } catch (addError) {
      setFormError(getErrorText(addError, 'That API key could not be added.'));
    } finally {
      setForm((current) => ({ ...current, apiKey: '' }));
      setIsAdding(false);
    }
  };

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential || !ipAddressInput.trim()) return;
    setIsAddingIp(true);
    setError(null);
    setIpSuccessMsg(null);
    try {
      const created = await createAdminIP(credential, {
        ip_address: ipAddressInput.trim(),
        description: ipDescInput.trim() || undefined,
      });
      setIps((prev) => [created, ...prev]);
      setIpAddressInput('');
      setIpDescInput('');
      setIpSuccessMsg(`IP ${created.ip_address} added to whitelist successfully.`);
    } catch (err) {
      setError(getErrorText(err, 'Failed to add IP address.'));
    } finally {
      setIsAddingIp(false);
    }
  };

  const handleDeleteIp = async (ipRecord: AdminIP) => {
    if (!credential || !window.confirm(`Remove IP ${ipRecord.ip_address}?`)) return;
    setDeletingIpId(ipRecord.id);
    setError(null);
    setIpSuccessMsg(null);
    try {
      await deleteAdminIP(credential, ipRecord.id);
      setIps((prev) => prev.filter((item) => item.id !== ipRecord.id));
      setIpSuccessMsg(`IP ${ipRecord.ip_address} removed.`);
    } catch (err) {
      setError(getErrorText(err, 'Failed to remove IP address.'));
    } finally {
      setDeletingIpId(null);
    }
  };

  const handleWhitelistCurrentIp = () => {
    if (clientIp) {
      setIpAddressInput(clientIp);
      setIpDescInput(`Admin workstation (${user?.email || 'current'})`);
    }
  };

  const handleDeleteKey = async (keyRecord: AdminKey) => {
    if (!credential || !window.confirm(`Delete ${keyRecord.label}? This cannot be undone.`)) return;
    setSavingKeyId(keyRecord.id);
    setError(null);
    try {
      await deleteAdminKey(credential, keyRecord.id);
      await loadDashboard(true);
    } catch (deleteError) {
      setError(getErrorText(deleteError, 'That key could not be deleted.'));
    } finally {
      setSavingKeyId(null);
    }
  };


  const handleAddCourtKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential) return;
    if (!courtForm.label.trim() || !courtForm.apiKey.trim()) {
      setFormError('Please enter both a label and the API key / token.');
      return;
    }

    setIsAddingCourtKey(true);
    setFormError(null);
    try {
      const created = await createCourtKey(credential, {
        provider: courtForm.provider,
        label: courtForm.label.trim(),
        api_key: courtForm.apiKey.trim(),
        base_url: courtForm.baseUrl.trim() || undefined,
        is_active: true,
      });

      setCourtKeys((prev) => [created, ...prev]);
      setCourtStatus((prev) => ({ ...prev, has_active_key: true, active_provider: created.provider, key_count: prev.key_count + 1 }));
      setCourtForm({ provider: 'surepass', label: '', apiKey: '', baseUrl: '' });
      setCourtSuccessMsg(`Successfully connected ${created.label} (${created.provider.toUpperCase()})`);
      setTimeout(() => setCourtSuccessMsg(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add Court API key');
    } finally {
      setIsAddingCourtKey(false);
    }
  };

  const handleToggleCourtKey = async (keyRecord: CourtAPIKey) => {
    if (!credential) return;
    try {
      const updated = await updateCourtKey(credential, keyRecord.id, {
        is_active: !keyRecord.is_active,
      });
      setCourtKeys((prev) => prev.map((k) => (k.id === keyRecord.id ? updated : k)));
      const refreshedStatus = await getCourtAPIStatus(credential);
      setCourtStatus(refreshedStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle court key');
    }
  };

  const handleDeleteCourtKey = async (keyRecord: CourtAPIKey) => {
    if (!credential) return;
    if (!confirm(`Are you sure you want to remove ${keyRecord.label}?`)) return;

    setDeletingCourtKeyId(keyRecord.id);
    try {
      await deleteCourtKey(credential, keyRecord.id);
      setCourtKeys((prev) => prev.filter((k) => k.id !== keyRecord.id));
      const refreshedStatus = await getCourtAPIStatus(credential);
      setCourtStatus(refreshedStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to delete court key');
    } finally {
      setDeletingCourtKeyId(null);
    }
  };

  const handleTestAdvocateVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential) return;
    if (!testAdvBarNo.trim() || !testAdvName.trim()) {
      alert('Please enter advocate full name and Bar registration number.');
      return;
    }
    setIsTestingAdv(true);
    setTestAdvResult(null);
    try {
      const data = await testLawyerVerification(credential, {
        bar_reg_no: testAdvBarNo.trim(),
        full_name: testAdvName.trim(),
        state_bar_council: testAdvCouncil.trim() || undefined,
        year_of_enrollment: Number(testAdvYear) || undefined,
        aibe_cop_number: testAdvCop.trim() || undefined,
      });
      setTestAdvResult(data);
    } catch (err: any) {
      setTestAdvResult({ error: err.message || 'Failed to run automated verification', verified: false });
    } finally {
      setIsTestingAdv(false);
    }
  };

  const handleTestCnrLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = testCnrInput.trim().toUpperCase();
    if (!clean) return;

    setIsTestingCnr(true);
    setTestCnrResult(null);
    try {
      if (!credential) {
        throw new Error('Authentication required: please log in to test court resolution.');
      }
      const data = await testCourtCnrLookup(credential, clean);
      setTestCnrResult(data);
    } catch (err: any) {
      setTestCnrResult({ error: err.message || 'Failed to query live court API', is_live_sync: false });
    } finally {
      setIsTestingCnr(false);
    }
  };


  const handleAddNotifProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential) return;

    let config: Record<string, any> = {};
    if (notifForm.channel === 'email') {
      if (notifForm.emailProvider === 'resend') {
        if (!notifForm.resendApiKey.trim()) {
          setFormError('Please enter your Resend API Key (re_...).');
          return;
        }
        config = {
          api_key: notifForm.resendApiKey.trim(),
          from_email: notifForm.resendFrom.trim() || 'TRANA eCourts <onboarding@resend.dev>',
        };
      } else {
        if (!notifForm.smtpHost.trim()) {
          setFormError('Please enter your SMTP Host (e.g. smtp.gmail.com).');
          return;
        }
        config = {
          host: notifForm.smtpHost.trim(),
          port: Number(notifForm.smtpPort) || 587,
          username: notifForm.smtpUsername.trim(),
          password: notifForm.smtpPassword.trim(),
          from_email: notifForm.smtpFrom.trim() || notifForm.smtpUsername.trim(),
          use_tls: true,
        };
      }
    } else {
      if (notifForm.smsProvider === 'fast2sms') {
        if (!notifForm.fast2smsApiKey.trim()) {
          setFormError('Please enter your Fast2SMS Authorization Key.');
          return;
        }
        config = { api_key: notifForm.fast2smsApiKey.trim() };
      } else {
        if (!notifForm.twilioSid.trim() || !notifForm.twilioToken.trim() || !notifForm.twilioFrom.trim()) {
          setFormError('Please enter Twilio Account SID, Auth Token, and From Number.');
          return;
        }
        config = {
          account_sid: notifForm.twilioSid.trim(),
          auth_token: notifForm.twilioToken.trim(),
          from_number: notifForm.twilioFrom.trim(),
        };
      }
    }

    const providerType = notifForm.channel === 'email' ? notifForm.emailProvider : notifForm.smsProvider;
    const label = notifForm.label.trim() || `${providerType.toUpperCase()} Gateway`;

    setIsAddingNotif(true);
    setFormError(null);
    try {
      const created = await createNotificationProvider(credential, {
        channel: notifForm.channel,
        provider: providerType,
        label,
        config,
      });

      setNotifProviders((prev) => [created, ...prev]);
      const statusRes = await getNotificationStatus(credential);
      setNotifStatus(statusRes);
      setNotifSuccessMsg(`Successfully registered ${created.label} (${created.provider.toUpperCase()})`);
      setTimeout(() => setNotifSuccessMsg(null), 5000);
      setNotifForm((prev) => ({
        ...prev,
        label: '',
        resendApiKey: '',
        smtpPassword: '',
        fast2smsApiKey: '',
        twilioToken: '',
      }));
    } catch (err: any) {
      setFormError(err.message || 'Failed to register notification provider');
    } finally {
      setIsAddingNotif(false);
    }
  };

  const handleToggleNotifProvider = async (item: NotificationProvider) => {
    if (!credential) return;
    try {
      const updated = await updateNotificationProvider(credential, item.id, {
        is_active: !item.is_active,
      });
      setNotifProviders((prev) => prev.map((p) => (p.id === item.id ? updated : p)));
      const statusRes = await getNotificationStatus(credential);
      setNotifStatus(statusRes);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle provider');
    }
  };

  const handleDeleteNotifProvider = async (item: NotificationProvider) => {
    if (!credential) return;
    if (!confirm(`Are you sure you want to delete ${item.label}?`)) return;

    setDeletingNotifId(item.id);
    try {
      await deleteNotificationProvider(credential, item.id);
      setNotifProviders((prev) => prev.filter((p) => p.id !== item.id));
      const statusRes = await getNotificationStatus(credential);
      setNotifStatus(statusRes);
    } catch (err: any) {
      setError(err.message || 'Failed to remove notification provider');
    } finally {
      setDeletingNotifId(null);
    }
  };

  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential) return;
    if (!testNotifEmail.trim() && !testNotifPhone.trim()) {
      alert('Please enter at least an email or mobile phone number for test dispatch.');
      return;
    }

    setIsTestingNotif(true);
    setTestNotifResult(null);
    try {
      const res = await fetch(`${API_URL}/api/cases/reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credential}`,
        },
        body: JSON.stringify({
          cnr: 'DLCT010036742023',
          email_alert: testNotifEmail.trim() || undefined,
          sms_phone: testNotifPhone.trim() || undefined,
          case_data: {
            cnr: 'DLCT010036742023',
            formatted_cnr: 'DLCT01-003674-2023',
            case_type: 'Cr Rev',
            case_number: '141/2023',
            court_name: 'District and Sessions Judge, Central, THC',
            court_room: 'Court Room No. 01',
            judge: 'SPECIAL JUDGE (NDPS)',
            petitioner: 'RAJEEV DANG',
            respondent: 'AJAY BEGWANI',
            petitioner_advocate: 'SANDEEP YADAV',
            respondent_advocate: 'Public Prosecutor',
            current_stage: 'Listing for Judicial Directions',
            next_hearing_date: 'Tomorrow, 10:30 AM',
            hearing_purpose: 'Arguments & Pleadings',
            last_order_summary: 'Notice returnable; cause list advisory dispatched by TRANA test runner.',
            source: 'National Judicial Data Grid (eCourts Live)',
          },
        }),
      });
      const data = await res.json();
      setTestNotifResult(data);
    } catch (err: any) {
      setTestNotifResult({ error: err.message || 'Test reminder dispatch failed' });
    } finally {
      setIsTestingNotif(false);
    }
  };

  const exportAdminCSV = () => {
    if (adminTab === 'keys') {
      const headers = [
        'Key ID',
        'Label',
        'Provider',
        'Model',
        'Mode',
        'Active',
        'Rotation Order',
        'Status',
        'Day Total Requests',
        'Day Success',
        'Day Failure',
        'Day Quota Hits',
        'Last Used At',
        'Created At',
      ];
      const usageMap = new Map(usage.map((u) => [u.keyId, u]));
      const rows = keys.map((k) => {
        const u = usageMap.get(k.id);
        return [
          k.id,
          k.label,
          k.provider,
          k.model,
          k.mode,
          k.active ? 'Yes' : 'No',
          k.rotationOrder,
          k.status || 'Ready',
          u?.day.total ?? 0,
          u?.day.success ?? 0,
          u?.day.failure ?? 0,
          u?.day.quota ?? 0,
          k.lastUsedAt || '—',
          k.createdAt || '—',
        ];
      });
      downloadCSV(`trana_provider_keys_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    } else {
      const headers = ['IP Address', 'Description / Label', 'Created At'];
      const rows = ips.map((ip) => [ip.ip_address, ip.description || '—', ip.created_at || '—']);
      downloadCSV(`trana_allowed_ips_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    }
  };

  // Direct dashboard render (authorized at /founders parent route)

  return (
    <div className="admin-page p-6 md:p-10 space-y-8 bg-[#0a0a0a] text-[#f0f0f0] min-h-screen">
      <header className="admin-page__header flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#222222]">
        <div>
          <p className="admin-eyebrow text-xs uppercase tracking-widest font-mono text-amber-200/80 mb-1">
            TRANA Operations
          </p>
          <h2 className="text-3xl font-serif tracking-tight text-neutral-100">Admin & Security Console</h2>
          <p className="admin-page__subtitle text-xs text-neutral-400 mt-1">
            Configure IP whitelisting / network access and LLM provider rotation.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            className="inline-flex items-center gap-2 border border-white/40 bg-[#161616] text-xs font-medium px-4 py-2 rounded-xl text-white hover:bg-white hover:text-black transition-colors"
            onClick={exportAdminCSV}
            title={adminTab === 'keys' ? 'Export Keys and Usage telemetry to CSV' : 'Export Allowed IPs to CSV'}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="admin-secondary-button inline-flex items-center gap-2 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-xs font-medium px-4 py-2 rounded-xl transition-colors"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Admin Tab Switcher */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#222222] pb-4">
        <button
          type="button"
          onClick={() => setAdminTab('court')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
            adminTab === 'court'
              ? 'bg-amber-400/10 border border-amber-400/50 text-amber-300 font-semibold shadow-sm'
              : 'bg-[#141414] border border-[#222222] text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Scale size={14} />
          <span>eCourts & NJDG API</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
            courtStatus.has_active_key ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#222222] text-neutral-400'
          }`}>
            {courtKeys.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('notifications')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
            adminTab === 'notifications'
              ? 'bg-amber-400/10 border border-amber-400/50 text-amber-300 font-semibold shadow-sm'
              : 'bg-[#141414] border border-[#222222] text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Bell size={14} />
          <span>Hearing Alerts (SMS & Email)</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
            (notifStatus.has_active_email || notifStatus.has_active_sms)
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-[#222222] text-neutral-400'
          }`}>
            {notifProviders.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('ips')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
            adminTab === 'ips'
              ? 'bg-amber-400/10 border border-amber-400/50 text-amber-300 font-semibold'
              : 'bg-[#141414] border border-[#222222] text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Network size={14} />
          <span>IP Whitelist Management</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#222222] text-[10px] font-mono text-neutral-300">
            {ips.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('keys')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
            adminTab === 'keys'
              ? 'bg-amber-400/10 border border-amber-400/50 text-amber-300 font-semibold'
              : 'bg-[#141414] border border-[#222222] text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <KeyRound size={14} />
          <span>LLM Provider Keys & Rotation</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#222222] text-[10px] font-mono text-neutral-300">
            {keys.length}
          </span>
        </button>
      </div>

      {error && (
        <div className="admin-alert admin-alert--error flex items-center gap-2.5 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {ipSuccessMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
          <Check size={16} />
          {ipSuccessMsg}
        </div>
      )}

      {adminTab === 'ips' && (
        <div className="space-y-8">
          {/* Current IP Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#121212] border border-[#242424]">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-[#1a1a1a] border border-[#2c2c2c] text-amber-300">
                <Globe size={22} />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                  Detected Client IP
                </p>
                <div className="font-mono text-lg font-semibold text-neutral-100 mt-0.5">
                  {clientIp || 'Detecting client IP...'}
                </div>
              </div>
            </div>
            {clientIp && (
              <button
                type="button"
                onClick={handleWhitelistCurrentIp}
                className="btn-solid text-xs py-2 px-4 flex items-center gap-2 shrink-0"
              >
                <Plus size={14} />
                <span>Quick-Add Current IP</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* IP Add Form */}
            <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-5">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Security Control</p>
                <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Add Allowed IP</h3>
                <p className="text-xs text-neutral-400 mt-1">Register an IP address to grant network access.</p>
              </div>

              <form onSubmit={handleAddIp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-300 mb-1.5">IP Address *</label>
                  <input
                    type="text"
                    placeholder="e.g. 103.21.14.88"
                    value={ipAddressInput}
                    onChange={(e) => setIpAddressInput(e.target.value)}
                    required
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs font-mono text-neutral-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-neutral-300 mb-1.5">Description / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Office / Workstation"
                    value={ipDescInput}
                    onChange={(e) => setIpDescInput(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingIp || !ipAddressInput.trim()}
                  className="btn-solid w-full text-xs py-2.5 flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  <span>{isAddingIp ? 'Adding IP...' : 'Add to Whitelist'}</span>
                </button>
              </form>
            </div>

            {/* Configured IPs List */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Network Rule</p>
                  <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Whitelisted IP Addresses</h3>
                </div>
                <span className="text-xs font-mono text-neutral-400 bg-[#1a1a1a] px-3 py-1 rounded-full border border-[#262626]">
                  {ips.length} {ips.length === 1 ? 'address' : 'addresses'} active
                </span>
              </div>

              {ips.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#262626] rounded-xl text-neutral-500 text-xs">
                  No IP addresses currently whitelisted. Add an IP using the form on the left.
                </div>
              ) : (
                <div className="space-y-3">
                  {ips.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#303030] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-amber-300">
                          <Network size={16} />
                        </div>
                        <div>
                          <div className="font-mono text-sm font-semibold text-neutral-100">
                            {item.ip_address}
                          </div>
                          {item.description && (
                            <div className="text-xs text-neutral-400 mt-0.5">{item.description}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                                  {item.created_at && (
                          <span className="text-[11px] font-mono text-neutral-500">
                            {formatIst(item.created_at)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteIp(item)}
                          disabled={deletingIpId === item.id}
                          className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] text-rose-400 hover:bg-rose-950/40 hover:border-rose-900 transition-colors"
                          title="Remove IP"
                        >
                          <Trash2 size={15} />
                          <span className="sr-only">Delete {item.ip_address}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Notification Gateway Tab (SMS & Email) */}
      {adminTab === 'notifications' && (
        <div className="space-y-8 font-sans">
          {/* Status & Architecture Banner */}
          <div className="p-6 rounded-2xl bg-[#121212] border border-[#242424] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  (notifStatus.has_active_email || notifStatus.has_active_sms)
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950/50 text-amber-300 border-amber-700/60'
                }`}>
                  <Bell size={20} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-[#1c1c1c] text-neutral-300 border border-[#2c2c2c]">
                      Hearing Alerts Gateway
                    </span>
                    {notifStatus.has_active_email ? (
                      <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-600/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Email: Active ({notifStatus.active_email_provider?.toUpperCase()})
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40">
                        Email: Awaiting Key
                      </span>
                    )}

                    {notifStatus.has_active_sms ? (
                      <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-600/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        SMS: Active ({notifStatus.active_sms_provider?.toUpperCase()})
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40">
                        SMS: Awaiting Gateway
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-serif text-white mt-1">
                    Automated Hearing Advisories & Calendar Gateway
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{notifProviders.length} {notifProviders.length === 1 ? 'Gateway' : 'Gateways'} Configured</span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed font-sans">
              Connect external messaging providers to dispatch real-time court hearing notices. <strong>Resend</strong> or <strong>SMTP</strong> sends beautifully styled judicial cause list advisories with attached <strong>RFC 5545 (.ics) Calendar</strong> invites that synchronize automatically into Google Calendar or Outlook. <strong>Fast2SMS</strong> or <strong>Twilio</strong> dispatches cellular SMS notifications directly to advocate and clerk mobile numbers.
            </p>
          </div>

          {notifSuccessMsg && (
            <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
              <Check size={16} />
              {notifSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Provider Form Column */}
            <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-5">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300">Provider Credentials</p>
                <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Connect Alert Provider</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Add credentials for your transactional email or SMS provider.
                </p>
              </div>

              <form onSubmit={handleAddNotifProvider} className="space-y-4">
                {/* Channel Toggle */}
                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                    Delivery Channel
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNotifForm({ ...notifForm, channel: 'email' })}
                      className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                        notifForm.channel === 'email'
                          ? 'bg-sky-950/60 text-sky-300 border-sky-600/60 font-semibold'
                          : 'bg-[#161616] text-neutral-400 border-[#2c2c2c]'
                      }`}
                    >
                      <Mail size={13} />
                      <span>Email (.ics Calendar)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifForm({ ...notifForm, channel: 'sms' })}
                      className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                        notifForm.channel === 'sms'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/60 font-semibold'
                          : 'bg-[#161616] text-neutral-400 border-[#2c2c2c]'
                      }`}
                    >
                      <Smartphone size={13} />
                      <span>Cellular SMS</span>
                    </button>
                  </div>
                </div>

                {/* Email Providers */}
                {notifForm.channel === 'email' && (
                  <>
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                        Email Service Provider
                      </label>
                      <select
                        value={notifForm.emailProvider}
                        onChange={(e) => setNotifForm({ ...notifForm, emailProvider: e.target.value as any })}
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                      >
                        <option value="resend">Resend API (Recommended • 3,000 free emails/mo)</option>
                        <option value="smtp">Standard SMTP (Gmail App Password / SendGrid / SES)</option>
                      </select>
                    </div>

                    {notifForm.emailProvider === 'resend' ? (
                      <>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                            Resend API Key *
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                            value={notifForm.resendApiKey}
                            onChange={(e) => setNotifForm({ ...notifForm, resendApiKey: e.target.value })}
                            className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                            Sender "From" Address
                          </label>
                          <input
                            type="text"
                            placeholder="TRANA eCourts <onboarding@resend.dev>"
                            value={notifForm.resendFrom}
                            onChange={(e) => setNotifForm({ ...notifForm, resendFrom: e.target.value })}
                            className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono text-[11px]"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                              SMTP Host *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="smtp.gmail.com"
                              value={notifForm.smtpHost}
                              onChange={(e) => setNotifForm({ ...notifForm, smtpHost: e.target.value })}
                              className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                              Port
                            </label>
                            <input
                              type="number"
                              value={notifForm.smtpPort}
                              onChange={(e) => setNotifForm({ ...notifForm, smtpPort: e.target.value })}
                              className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                            Username / Email *
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="advocate@gmail.com"
                            value={notifForm.smtpUsername}
                            onChange={(e) => setNotifForm({ ...notifForm, smtpUsername: e.target.value })}
                            className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                            App Password *
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="Gmail 16-character App Password"
                            value={notifForm.smtpPassword}
                            onChange={(e) => setNotifForm({ ...notifForm, smtpPassword: e.target.value })}
                            className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* SMS Providers */}
                {notifForm.channel === 'sms' && (
                  <>
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                        SMS Gateway Provider
                      </label>
                      <select
                        value={notifForm.smsProvider}
                        onChange={(e) => setNotifForm({ ...notifForm, smsProvider: e.target.value as any })}
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                      >
                        <option value="fast2sms">Fast2SMS (Indian Cellular Gateway • Instant API Key)</option>
                        <option value="twilio">Twilio Global SMS (E.164 Cellular Delivery)</option>
                      </select>
                    </div>

                    {notifForm.smsProvider === 'fast2sms' ? (
                      <div>
                        <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                          Fast2SMS Authorization Key *
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Enter Fast2SMS API key from Dev portal"
                          value={notifForm.fast2smsApiKey}
                          onChange={(e) => setNotifForm({ ...notifForm, fast2smsApiKey: e.target.value })}
                          className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                            Twilio Account SID *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={notifForm.twilioSid}
                            onChange={(e) => setNotifForm({ ...notifForm, twilioSid: e.target.value })}
                            className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                            Twilio Auth Token *
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="Twilio secret auth token"
                            value={notifForm.twilioToken}
                            onChange={(e) => setNotifForm({ ...notifForm, twilioToken: e.target.value })}
                            className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                            Twilio From Phone Number *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="+1234567890"
                            value={notifForm.twilioFrom}
                            onChange={(e) => setNotifForm({ ...notifForm, twilioFrom: e.target.value })}
                            className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                    Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Primary Production Mailer"
                    value={notifForm.label}
                    onChange={(e) => setNotifForm({ ...notifForm, label: e.target.value })}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingNotif}
                  className="btn-solid w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>{isAddingNotif ? 'Saving Provider...' : 'Save Notification Gateway'}</span>
                </button>
              </form>
            </div>

            {/* Configured Providers & Live Test Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Providers List Card */}
              <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Connected Services</p>
                    <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Notification Providers</h3>
                  </div>
                  <span className="text-xs font-mono text-neutral-400 bg-[#1a1a1a] px-3 py-1 rounded-full border border-[#262626]">
                    {notifProviders.length} {notifProviders.length === 1 ? 'gateway' : 'gateways'}
                  </span>
                </div>

                {notifProviders.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-[#262626] rounded-xl text-neutral-500 text-xs space-y-2">
                    <p>No external notification providers configured yet.</p>
                    <p className="text-[11px] text-neutral-600">
                      Add a Resend API key or Fast2SMS key on the left to start sending real emails and SMS hearing alerts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifProviders.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#303030] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                            item.channel === 'email'
                              ? 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                              : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                          }`}>
                            {item.channel === 'email' ? <Mail size={16} /> : <Smartphone size={16} />}
                          </div>
                          <div>
                            <div className="font-sans text-sm font-semibold text-neutral-100 flex items-center gap-2">
                              <span>{item.label}</span>
                              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#202020] text-amber-300 border border-[#333333]">
                                {item.provider}
                              </span>
                              <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded ${
                                item.channel === 'email' ? 'bg-sky-950 text-sky-300' : 'bg-emerald-950 text-emerald-300'
                              }`}>
                                {item.channel}
                              </span>
                            </div>
                            <div className="font-mono text-xs text-neutral-400 mt-0.5">
                              Key: {item.masked_key}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleToggleNotifProvider(item)}
                            className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                              item.is_active
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}
                          >
                            {item.is_active ? 'Active' : 'Disabled'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteNotifProvider(item)}
                            disabled={deletingNotifId === item.id}
                            className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] text-rose-400 hover:bg-rose-950/40 hover:border-rose-900 transition-colors"
                            title="Remove provider"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interactive Test Alert Dispatcher */}
              <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300">Live Delivery Testing</p>
                  <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Test Live Hearing Alert Dispatch</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Send an authentic court hearing advisory (with .ics Calendar invite) to your personal inbox or mobile phone to verify provider delivery.
                  </p>
                </div>

                <form onSubmit={handleSendTestNotification} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Test Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="your-email@gmail.com"
                        value={testNotifEmail}
                        onChange={(e) => setTestNotifEmail(e.target.value)}
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Test Mobile Phone (SMS)
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 9315254223"
                        value={testNotifPhone}
                        onChange={(e) => setTestNotifPhone(e.target.value)}
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2 text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isTestingNotif || (!testNotifEmail.trim() && !testNotifPhone.trim())}
                    className="w-full sm:w-auto px-6 py-2.5 bg-amber-400 text-black text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={13} />
                    <span>{isTestingNotif ? 'Dispatching Live Alert...' : 'Dispatch Test Hearing Notice'}</span>
                  </button>
                </form>

                {testNotifResult && (
                  <div className="mt-3 p-4 bg-[#141414] border border-[#282828] rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                      <span className="text-neutral-400">Live Gateway Dispatch Result:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        testNotifResult.ok ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-300'
                      }`}>
                        {testNotifResult.ok ? 'DISPATCH COMPLETE' : 'GATEWAY ERROR'}
                      </span>
                    </div>
                    <pre className="text-[11px] text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(testNotifResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Court API Management Tab */}
      {adminTab === 'court' && (
        <div className="space-y-8 font-sans">
          {/* Status & Architecture Banner */}
          <div className="p-6 rounded-2xl bg-[#121212] border border-[#242424] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  courtStatus.has_active_key 
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800' 
                    : 'bg-amber-950/50 text-amber-300 border-amber-700/60'
                }`}>
                  <Scale size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-[#1c1c1c] text-neutral-300 border border-[#2c2c2c]">
                      National Judicial Data Grid (NJDG)
                    </span>
                    {courtStatus.has_active_key ? (
                      <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-600/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live Gateway Active ({courtStatus.active_provider?.toUpperCase()})
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40">
                        Awaiting Live API Key (Decoder Mode)
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-serif text-white mt-1">
                    eCourts & Court Records Gateway
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{courtKeys.length} {courtKeys.length === 1 ? 'Key' : 'Keys'} Registered</span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed font-sans">
              The official Government of India eCourts portal (<code className="text-neutral-200">services.ecourts.gov.in</code>) requires image CAPTCHAs to prevent unauthenticated scraping. Connect an authenticated Court Data API provider (such as <strong>Surepass</strong>, <strong>eCourtsIndia</strong>, or <strong>Indian Kanoon</strong>) to automatically fetch real litigant names, exact judicial officers, courtroom numbers, and certified order copies for any 16-character CNR number across Indian High Courts and District Courts.
            </p>
          </div>

          {courtSuccessMsg && (
            <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
              <Check size={16} />
              {courtSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column */}
            <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-5">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300">Court Registry Credentials</p>
                <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Connect Court API</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Add credentials for your eCourts provider. Keys are stored encrypted in the backend.
                </p>
              </div>

              <form onSubmit={handleAddCourtKey} className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                    API Provider
                  </label>
                  <select
                    value={courtForm.provider}
                    onChange={(e) => setCourtForm({ ...courtForm, provider: e.target.value })}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="surepass">Surepass Court Case Search (Recommended)</option>
                    <option value="attestr">Attestr Advocate & Bar Verification API (Recommended for Lawyers)</option>
                    <option value="ecourtsindia">eCourtsIndia Enterprise REST API</option>
                    <option value="indiankanoon">Indian Kanoon Search API</option>
                    <option value="claw">Claw Legaltech / Vakeel360 API</option>
                    <option value="custom">Custom eCourts Gateway (Webhook / Proxy)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                    Key Label
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Primary Surepass Production Key"
                    value={courtForm.label}
                    onChange={(e) => setCourtForm({ ...courtForm, label: e.target.value })}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                    API Key / Secret Token
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter raw secret key or bearer token"
                    value={courtForm.apiKey}
                    onChange={(e) => setCourtForm({ ...courtForm, apiKey: e.target.value })}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                    Custom Base URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="e.g. https://kyc-api.surepass.io or leave blank"
                    value={courtForm.baseUrl}
                    onChange={(e) => setCourtForm({ ...courtForm, baseUrl: e.target.value })}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingCourtKey || !courtForm.label.trim() || !courtForm.apiKey.trim()}
                  className="btn-solid w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>{isAddingCourtKey ? 'Connecting Key...' : 'Save Court API Key'}</span>
                </button>
              </form>
            </div>

            {/* Configured Keys & Live Test Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Keys List */}
              <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Registry Gateway</p>
                    <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Configured Court Providers</h3>
                  </div>
                  <span className="text-xs font-mono text-neutral-400 bg-[#1a1a1a] px-3 py-1 rounded-full border border-[#262626]">
                    {courtKeys.length} {courtKeys.length === 1 ? 'credential' : 'credentials'}
                  </span>
                </div>

                {courtKeys.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-[#262626] rounded-xl text-neutral-500 text-xs space-y-2">
                    <p>No external eCourts API keys configured yet.</p>
                    <p className="text-[11px] text-neutral-600">
                      Add a key for Surepass, eCourtsIndia, or Indian Kanoon to enable real-time case data queries for any CNR number.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {courtKeys.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#303030] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-amber-300">
                            <Scale size={17} />
                          </div>
                          <div>
                            <div className="font-sans text-sm font-semibold text-neutral-100 flex items-center gap-2">
                              <span>{item.label}</span>
                              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#202020] text-amber-300 border border-[#333333]">
                                {item.provider}
                              </span>
                            </div>
                            <div className="font-mono text-xs text-neutral-400 mt-0.5">
                              Key: {item.masked_key} {item.base_url ? `• ${item.base_url}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleToggleCourtKey(item)}
                            className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                              item.is_active
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}
                          >
                            {item.is_active ? 'Active' : 'Disabled'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteCourtKey(item)}
                            disabled={deletingCourtKeyId === item.id}
                            className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] text-rose-400 hover:bg-rose-950/40 hover:border-rose-900 transition-colors"
                            title="Remove key"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live CNR Verification & Diagnostics */}
              <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300">Court Registry Diagnostics</p>
                  <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Test Live CNR Resolution</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Verify how any Indian court CNR number resolves through your configured API gateway.
                  </p>
                </div>

                <form onSubmit={handleTestCnrLookup} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={testCnrInput}
                    onChange={(e) => setTestCnrInput(e.target.value)}
                    placeholder="e.g. DLCT010036742023 or MHAU019999992015"
                    className="flex-1 bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={isTestingCnr || !testCnrInput.trim()}
                    className="px-5 py-2.5 bg-amber-400 text-black text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Search size={14} />
                    <span>{isTestingCnr ? 'Querying Court...' : 'Test Resolution'}</span>
                  </button>
                </form>

                {testCnrResult && (
                  <div className="mt-3 p-4 bg-[#141414] border border-[#282828] rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                      <span className="text-neutral-400">Gateway Resolution Result:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        testCnrResult.error
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : testCnrResult.is_live_sync
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {testCnrResult.error
                          ? 'GATEWAY ERROR'
                          : testCnrResult.is_live_sync
                          ? 'LIVE SYNC (VERIFIED)'
                          : 'DECODER MODE'}
                      </span>
                    </div>
                    <pre className="text-[11px] text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(testCnrResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Live Advocate Sanad Verification & Diagnostics */}
              <div className="p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-4 font-sans">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300">Statutory Advocate Diagnostics</p>
                    <h3 className="text-xl font-serif text-neutral-100 mt-0.5">Test Live Advocate Verification</h3>
                    <p className="text-xs text-neutral-400 mt-1 font-sans">
                      Validate any Indian advocate against statutory Bar Council Sanad rules, AIBE COP formatting, Attestr BGV API, and active eCourts appearances.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-amber-300 shrink-0">
                    <Award size={20} />
                  </div>
                </div>

                <form onSubmit={handleTestAdvocateVerification} className="space-y-3 font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Advocate Full Name
                      </label>
                      <input
                        type="text"
                        value={testAdvName}
                        onChange={(e) => setTestAdvName(e.target.value)}
                        placeholder="e.g. Adv. Krish Chauhan"
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-sans"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Bar Sanad / Reg No. (STATE/NO/YEAR)
                      </label>
                      <input
                        type="text"
                        value={testAdvBarNo}
                        onChange={(e) => setTestAdvBarNo(e.target.value.toUpperCase())}
                        placeholder="e.g. D/2104/2021 or MAH/1234/2018"
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3.5 py-2 text-xs text-neutral-100 font-mono uppercase focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        State Bar Council
                      </label>
                      <select
                        value={testAdvCouncil}
                        onChange={(e) => setTestAdvCouncil(e.target.value)}
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-2.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-sans"
                      >
                        {ALL_STATE_BAR_COUNCILS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Enrollment Year
                      </label>
                      <input
                        type="number"
                        value={testAdvYear}
                        onChange={(e) => setTestAdvYear(e.target.value)}
                        placeholder="e.g. 2021"
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        AIBE COP Number
                      </label>
                      <input
                        type="text"
                        value={testAdvCop}
                        onChange={(e) => setTestAdvCop(e.target.value)}
                        placeholder="e.g. COP/2021/08912"
                        className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isTestingAdv || !testAdvBarNo.trim() || !testAdvName.trim()}
                    className="w-full px-5 py-2.5 bg-amber-400 text-black text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap font-sans"
                  >
                    <Award size={14} />
                    <span>{isTestingAdv ? 'Executing Verification...' : 'Run Live Auto-Verification Diagnostic'}</span>
                  </button>
                </form>

                {testAdvResult && (
                  <div className="mt-3 p-4 bg-[#141414] border border-[#282828] rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                      <span className="text-neutral-400">Resolution Status:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        testAdvResult.error || testAdvResult.status === 'REJECTED'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : testAdvResult.verified
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {testAdvResult.error
                          ? 'VERIFICATION ERROR'
                          : testAdvResult.verified
                          ? `VERIFIED (SCORE: ${testAdvResult.score})`
                          : 'PENDING VERIFICATION'}
                      </span>
                    </div>
                    <pre className="text-[11px] text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(testAdvResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


            {adminTab === 'keys' && (
      <div className="admin-page__content space-y-8">
        <section className="admin-panel admin-panel--intro flex items-start gap-4 p-5 rounded-2xl bg-[#121212] border border-[#222222]">
          <div className="admin-panel__icon p-2.5 rounded-xl bg-[#1a1a1a] border border-[#2c2c2c] text-amber-200/90 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="admin-panel__kicker text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Private Workspace
            </p>
            <h3 className="text-base font-semibold text-neutral-200 mt-0.5">
              {user?.email || 'Authorized Administrator'}
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Only allowlisted administrator accounts can manage keys and view usage. Raw provider secrets are hashed and never shown here.
            </p>
          </div>
        </section>

        <div className="admin-grid admin-grid--top grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="admin-panel lg:col-span-2 p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-6">
            <div className="admin-section-heading flex items-center justify-between">
              <div>
                <p className="admin-panel__kicker text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                  Rotation Pool
                </p>
                <h3 className="text-xl font-serif text-neutral-100">Configured API Keys</h3>
              </div>
              <span className="admin-count-badge font-mono text-xs px-2.5 py-1 rounded-full bg-[#1c1c1c] border border-[#2c2c2c] text-amber-200/90">
                {keys.length} configured
              </span>
            </div>

            <form
              className="admin-key-form grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#141414] border border-[#242424]"
              onSubmit={(event) => void handleAddKey(event)}
            >
              <label className="admin-field flex flex-col gap-1 text-xs text-neutral-300">
                <span>Label</span>
                <input
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Primary Groq production key"
                  maxLength={80}
                  className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                />
              </label>

              <label className="admin-field flex flex-col gap-1 text-xs text-neutral-300">
                <span>Provider API Key</span>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder="Paste secret key (cleared on submit)"
                  autoComplete="off"
                  spellCheck={false}
                  className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                />
              </label>

              <label className="admin-field flex flex-col gap-1 text-xs text-neutral-300">
                <span>Provider</span>
                <select
                  value={form.provider}
                  onChange={(event) => {
                    const nextProvider = event.target.value as KeyFormState['provider'];
                    const defaultModels: Record<string, string> = {
                      groq: 'llama-3.3-70b-versatile',
                      google: 'gemini-2.5-flash',
                      cerebras: 'llama3.3-70b',
                      llama: 'llama-3.3-70b-versatile',
                    };
                    setForm((current) => ({
                      ...current,
                      provider: nextProvider,
                      model: defaultModels[nextProvider] || current.model,
                    }));
                  }}
                  className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="groq">Groq</option>
                  <option value="cerebras">Cerebras</option>
                  <option value="google">Google</option>
                  <option value="llama">Llama-compatible</option>
                </select>
              </label>

              <label className="admin-field flex flex-col gap-1 text-xs text-neutral-300">
                <span>Model ID</span>
                <input
                  value={form.model}
                  onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                  placeholder="llama-3.3-70b-versatile"
                  className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                />
              </label>

              <label className="admin-field flex flex-col gap-1 text-xs text-neutral-300 md:col-span-2">
                <span>Custom Base URL (optional)</span>
                <input
                  value={form.baseUrl}
                  onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder="https://api.groq.com/openai/v1 or custom OpenAI-compatible endpoint"
                  className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                />
              </label>

              <label className="admin-field flex flex-col gap-1 text-xs text-neutral-300">
                <span>Rotation Order</span>
                <input
                  type="number"
                  min="1"
                  value={form.rotationOrder}
                  onChange={(event) => setForm((current) => ({ ...current, rotationOrder: event.target.value }))}
                  className="w-24 bg-[#1a1a1a] border border-[#2c2c2c] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400 font-mono"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="admin-primary-button inline-flex items-center justify-center gap-2 bg-neutral-200 text-neutral-900 hover:bg-white text-xs font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40 w-full"
                  disabled={isAdding}
                >
                  <KeyRound size={14} />
                  {isAdding ? 'Adding Key…' : 'Add Key to Pool'}
                </button>
              </div>
            </form>

            {formError && (
              <p className="admin-form-error inline-flex items-center gap-1.5 text-xs text-rose-400">
                <XCircle size={14} />
                {formError}
              </p>
            )}

            <div className="admin-key-list space-y-3">
              {loading ? (
                <div className="admin-empty-state text-center py-8 text-xs text-neutral-500 font-mono flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  Loading rotation keys…
                </div>
              ) : keys.length === 0 ? (
                <div className="admin-empty-state text-center py-8 text-xs text-neutral-500 font-mono flex items-center justify-center gap-2">
                  <KeyRound size={16} />
                  No API keys configured yet.
                </div>
              ) : (
                keys.map((keyRecord) => (
                  <AdminKeyRow
                    key={keyRecord.id}
                    keyRecord={keyRecord}
                    rotationDraft={rotationDrafts[keyRecord.id] ?? String(keyRecord.rotationOrder)}
                    isSaving={savingKeyId === keyRecord.id}
                    onRotationChange={(value) =>
                      setRotationDrafts((current) => ({ ...current, [keyRecord.id]: value }))
                    }
                    onRotationBlur={() => {
                      const nextOrder = Number(rotationDrafts[keyRecord.id]);
                      if (Number.isInteger(nextOrder) && nextOrder >= 1 && nextOrder !== keyRecord.rotationOrder) {
                        void updateKey(keyRecord, { rotation_order: nextOrder });
                      }
                    }}
                    onToggle={() => void updateKey(keyRecord, { active: !keyRecord.active })}
                    onDelete={() => void handleDeleteKey(keyRecord)}
                  />
                ))
              )}
            </div>
          </section>

          <section className="admin-panel admin-panel--notes p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-4">
            <p className="admin-panel__kicker text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Rotation Notes
            </p>
            <h3 className="text-xl font-serif text-neutral-100">Keep the pool healthy</h3>
            <ul className="space-y-3 text-xs text-neutral-400">
              <li className="flex items-start gap-2">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Active keys are prioritized in sequential rotation order.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Deactivate a key before deleting it for seamless rotation fallback.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Usage counts track statutory queries dispatched through the TRANA gateway.</span>
              </li>
            </ul>
          </section>
        </div>

        <section className="admin-panel p-6 rounded-2xl bg-[#111111] border border-[#222222] space-y-6">
          <div className="admin-section-heading flex items-center justify-between">
            <div>
              <p className="admin-panel__kicker text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Provider Telemetry
              </p>
              <h3 className="text-xl font-serif text-neutral-100">Usage by Key</h3>
            </div>
            <span className="admin-timezone font-mono text-[11px] text-neutral-500">
              All timestamps & buckets use IST
            </span>
          </div>

          <div className="admin-usage-list grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="admin-empty-state col-span-2 text-center py-8 text-xs text-neutral-500 font-mono">
                Loading usage…
              </div>
            ) : keys.length === 0 ? (
              <div className="admin-empty-state col-span-2 text-center py-8 text-xs text-neutral-500 font-mono">
                Add an API key to start tracking usage telemetry.
              </div>
            ) : (
              keys.map((keyRecord) => {
                const keyUsage =
                  usageByKey.get(keyRecord.id) ||
                  new Map([
                    ['__quick__', { label: 'Quick Thinking', minute: { ...EMPTY_BUCKET }, day: { ...EMPTY_BUCKET } }],
                  ]);
                const modelUsages = Array.from(keyUsage.values());
                return (
                  <article
                    className="admin-usage-card p-5 rounded-xl bg-[#141414] border border-[#242424] space-y-4"
                    key={keyRecord.id}
                  >
                    <div className="admin-usage-card__header flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-neutral-100">{keyRecord.label}</h4>
                        <span className="font-mono text-xs text-neutral-400">{keyRecord.maskedKey}</span>
                      </div>
                      <span
                        className={`admin-status-pill text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          keyRecord.active
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {keyRecord.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="admin-usage-periods space-y-3">
                      <div>
                        <p className="admin-period-label text-[11px] font-mono text-neutral-400 mb-1">
                          Current Minute
                        </p>
                        {modelUsages.map((modelUsage) => (
                          <UsageCard
                            key={`minute-${modelUsage.label}`}
                            label={modelUsage.label}
                            bucket={modelUsage.minute}
                          />
                        ))}
                      </div>
                      <div>
                        <p className="admin-period-label text-[11px] font-mono text-neutral-400 mb-1">
                          Today · IST
                        </p>
                        {modelUsages.map((modelUsage) => (
                          <UsageCard
                            key={`day-${modelUsage.label}`}
                            label={modelUsage.label}
                            bucket={modelUsage.day}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="admin-usage-updated text-[11px] text-neutral-500 font-mono pt-2 border-t border-[#1e1e1e]">
                      Last request: {formatIst(keyRecord.lastUsedAt)}
                    </p>
                  </article>
                );
              })
            )}
          </div>
          {!loading && usage.length === 0 && keys.length > 0 && (
            <p className="admin-footnote text-center text-xs text-neutral-500 font-mono">
              No usage has been recorded for the configured keys yet.
            </p>
          )}
        </section>
      </div>
      )}
    </div>
  );
}

const AdminState: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  tone?: 'warning';
}> = ({ icon, title, message, actionLabel, onAction, tone }) => (
  <div className="admin-state-page flex items-center justify-center min-h-[60vh] p-6">
    <div
      className={`admin-state-card max-w-md w-full p-8 rounded-2xl bg-[#111111] border text-center space-y-4 ${
        tone === 'warning' ? 'border-amber-700/60 shadow-amber-950/20' : 'border-[#262626]'
      }`}
    >
      <div className="admin-state-icon w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#2e2e2e] flex items-center justify-center mx-auto text-amber-200/90">
        {icon}
      </div>
      <h2 className="text-xl font-serif text-neutral-100">{title}</h2>
      <p className="text-xs text-neutral-400 leading-relaxed">{message}</p>
      <button
        type="button"
        className="admin-primary-button inline-flex items-center justify-center bg-neutral-200 text-neutral-900 hover:bg-white text-xs font-medium px-5 py-2.5 rounded-lg transition-colors w-full"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  </div>
);
