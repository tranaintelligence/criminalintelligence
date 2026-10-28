import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuthUser } from './trana-types';
import { API_URL } from './trana-backend';

export const SESSION_EXPIRED_EVENT = 'trana:session-expired';
export const API_ONLINE_EVENT = 'trana:api-online';

export const notifyApiOnline = (sourceRegistryReady = false): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(API_ONLINE_EVENT, {
        detail: { sourceRegistryReady },
      }),
    );
  }
};

export interface AuthContextValue {
  credential: string | null;
  user: AuthUser | null;
  sessionExpiresAt: string | null;
  signIn?: (credential: string) => Promise<void>;
  signOut: () => void;
  loading?: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const authHeaders = (credential: string | null): Record<string, string> => (
  credential ? { Authorization: `Bearer ${credential}` } : {}
);

/**
 * Make an authenticated request and notify listeners when the backend
 * returns 401 on an authenticated call.
 */
export const authFetch = async (
  input: RequestInfo | URL,
  credential: string | null,
  init: RequestInit = {},
): Promise<Response> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...authHeaders(credential),
      ...init.headers,
    },
  });

  if (response.status === 401 && typeof window !== 'undefined' && credential) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  if (response.ok) notifyApiOnline();

  return response;
};

/**
 * Read stored TRANA session token from localStorage if in browser.
 */
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('trana_session_token');
  } catch {
    return null;
  }
}

/**
 * Read stored TRANA user profile from localStorage if in browser.
 */
function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('trana_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Hook providing the authenticated user and TRANA session token / Supabase JWT.
 */
export const useTranaCredential = (): AuthContextValue => {
  const [credential, setCredential] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    // 1. Initial check: if already stored in localStorage, we are ready immediately
    const localToken = getStoredToken();
    const localUser = getStoredUser();
    if (localToken && localUser) {
      setCredential(localToken);
      setUser(localUser);
      setLoading(false);
    }

    // 2. Listen to storage changes across tabs/windows or login triggers
    const handleStorage = (e: StorageEvent) => {
      if (!mounted) return;
      if (e.key === 'trana_session_token') {
        setCredential(e.newValue);
      }
      if (e.key === 'trana_user') {
        try {
          setUser(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Fallback to Supabase auth session only if no TRANA direct session is present
    if (!localToken) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted || getStoredToken()) return;
        if (session) {
          const metadata = (session.user.user_metadata || {}) as Record<string, unknown>;
          setCredential(session.access_token);
          setUser({
            id: session.user.id,
            google_id: (typeof metadata['sub'] === 'string' ? metadata['sub'] : null) || session.user.id,
            email: session.user.email || '',
            name:
              (typeof metadata['full_name'] === 'string' ? metadata['full_name'] : null) ||
              (typeof metadata['name'] === 'string' ? metadata['name'] : null) ||
              session.user.email ||
              null,
            picture:
              (typeof metadata['avatar_url'] === 'string' ? metadata['avatar_url'] : null) ||
              (typeof metadata['picture'] === 'string' ? metadata['picture'] : null) ||
              null,
          });
        }
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted || getStoredToken()) return;
        if (session) {
          const metadata = (session.user.user_metadata || {}) as Record<string, unknown>;
          setCredential(session.access_token);
          setUser({
            id: session.user.id,
            google_id: (typeof metadata['sub'] === 'string' ? metadata['sub'] : null) || session.user.id,
            email: session.user.email || '',
            name:
              (typeof metadata['full_name'] === 'string' ? metadata['full_name'] : null) ||
              (typeof metadata['name'] === 'string' ? metadata['name'] : null) ||
              session.user.email ||
              null,
            picture:
              (typeof metadata['avatar_url'] === 'string' ? metadata['avatar_url'] : null) ||
              (typeof metadata['picture'] === 'string' ? metadata['picture'] : null) ||
              null,
          });
        } else {
          setCredential(null);
          setUser(null);
        }
        setLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
        window.removeEventListener('storage', handleStorage);
      };
    }

    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return {
    credential,
    user,
    sessionExpiresAt: null,
    signIn: async (nextCredential: string) => {
      setCredential(nextCredential);
      if (typeof window !== 'undefined') {
        localStorage.setItem('trana_session_token', nextCredential);
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: nextCredential }),
        });
        if (res.ok) {
          const data = (await res.json()) as { session_token?: string; user?: AuthUser };
          if (data.session_token) {
            setCredential(data.session_token);
            if (typeof window !== 'undefined') {
              localStorage.setItem('trana_session_token', data.session_token);
            }
          }
          if (data.user) {
            setUser(data.user);
            if (typeof window !== 'undefined') {
              localStorage.setItem('trana_user', JSON.stringify(data.user));
            }
          }
        }
      } catch {
        // keep raw credential
      }
    },
    signOut: () => {
      if (credential) {
        void fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${credential}` },
        }).catch(() => undefined);
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('trana_session_token');
        localStorage.removeItem('trana_user');
      }
      supabase.auth.signOut().catch(() => {});
      setCredential(null);
      setUser(null);
    },
    loading,
  };
};

export const useAuth = useTranaCredential;
