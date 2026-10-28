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
 * Hook providing the authenticated user and Supabase JWT / TRANA session credential.
 */
export const useTranaCredential = (): AuthContextValue => {
  const [credential, setCredential] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
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
    };
  }, []);

  return {
    credential,
    user,
    sessionExpiresAt: null,
    signIn: async (nextCredential: string) => {
      setCredential(nextCredential);
      try {
        const res = await fetch(`${API_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: nextCredential }),
        });
        if (res.ok) {
          const data = (await res.json()) as { session_token?: string; user?: AuthUser };
          if (data.session_token) setCredential(data.session_token);
          if (data.user) setUser(data.user);
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
      supabase.auth.signOut();
    },
    loading,
  };
};

export const useAuth = useTranaCredential;
