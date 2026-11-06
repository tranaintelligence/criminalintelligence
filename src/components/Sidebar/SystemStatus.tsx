import React from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';

interface SystemStatusProps {
  status: 'checking' | 'online' | 'offline';
  sourceRegistryReady: boolean;
  onRetry: () => void;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  status,
  sourceRegistryReady,
  onRetry,
}) => {
  const label =
    status === 'checking'
      ? 'Checking Engine…'
      : status === 'online'
        ? 'Engine Online'
        : 'Engine Offline';

  return (
    <div className="status-bar flex flex-col gap-2 text-xs text-neutral-400 bg-white/[0.03] border border-white/[0.08] rounded-xl p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`status-dot w-2 h-2 rounded-full ${
              status === 'online'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                : status === 'checking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
            }`}
          />
          <span className="font-medium text-xs text-neutral-200">{label}</span>
        </div>
        {status === 'offline' && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 transition-colors font-mono"
          >
            <RefreshCw size={10} />
            Retry
          </button>
        )}
      </div>

      <div
        className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono"
        title="Verified statutory legal-source registry"
      >
        <ShieldCheck
          size={12}
          className={sourceRegistryReady ? 'text-emerald-400 shrink-0' : 'text-neutral-500 shrink-0'}
        />
        <span className={sourceRegistryReady ? 'text-emerald-400/90 truncate' : 'text-neutral-500 truncate'}>
          {sourceRegistryReady ? 'Statutory registry active' : 'Sources offline'}
        </span>
      </div>
    </div>
  );
};
