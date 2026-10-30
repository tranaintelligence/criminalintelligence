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
} from '@/lib/trana-admin-api';
import type { AdminKey, AdminUsageRow, UsageBucket, AdminIP } from '@/lib/trana-admin-api';

export const Route = createFileRoute('/founders/admin')({
  head: () => ({
    meta: [
      { title: 'API Keys & Admin Console TRANA' },
      { name: 'description', content: 'Manage provider rotation and monitor Quick Thinking capacity.' },
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
    model: 'openai/gpt-oss-120b',
    mode: 'quick',
    baseUrl: '',
    rotationOrder: '1',
  });
  const [isAdding, setIsAdding] = useState(false);
  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);
  const [rotationDrafts, setRotationDrafts] = useState<Record<string, string>>({});

  // IP Management State
  const [adminTab, setAdminTab] = useState<'ips' | 'keys'>('ips');
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

        const [nextKeys, nextUsage, nextIps, currentIp] = await Promise.all([
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
        ]);
        setAccessState('authorized');
        setKeys(nextKeys);
        setUsage(nextUsage);
        setIps(nextIps);
        setClientIp(currentIp);
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

  if (accessState === 'unauthenticated') {
    return (
      <AdminState
        icon={<LockKeyhole size={22} />}
        title="Sign in to continue"
        message="The admin console requires an authenticated account with administrator access."
        actionLabel="Go to Login"
        onAction={() => navigate({ to: '/auth' })}
      />
    );
  }

  if (accessState === 'checking') {
    return (
      <AdminState
        icon={<RefreshCw size={22} className="admin-spin animate-spin" />}
        title="Checking admin access"
        message="Verifying your account permissions before opening the private console."
        actionLabel="Back to Overview"
        onAction={() => navigate({ to: '/founders' })}
      />
    );
  }

  if (accessState === 'forbidden') {
    return (
      <AdminState
        icon={<ShieldCheck size={22} />}
        title="Admin access required"
        message={`The account ${user?.email || 'currently signed in'} is not on the administrator allowlist.`}
        actionLabel="Back to Overview"
        onAction={() => navigate({ to: '/founders' })}
        tone="warning"
      />
    );
  }

  if (accessState === 'error' && !keys.length) {
    return (
      <AdminState
        icon={<AlertTriangle size={22} />}
        title="Admin console unavailable"
        message={error || 'The admin console could not be loaded.'}
        actionLabel="Try again"
        onAction={() => void loadDashboard(true)}
        tone="warning"
      />
    );
  }

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
      <div className="flex items-center gap-3 border-b border-[#222222] pb-4">
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
                  onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
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
                  placeholder="openai/gpt-oss-120b"
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
