import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { API_URL } from "@/lib/trana-backend";

type Search = { redirect?: string | undefined };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: (momentListener?: (notification: Record<string, unknown>) => void) => void;
        };
      };
    };
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const r = s["redirect"];
    return { redirect: typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : undefined };
  },
  head: () => ({
    meta: [
      { title: "Sign in TRANA" },
      { name: "description", content: "Sign in with Google to access TRANA legal intelligence and chat." },
      { property: "og:title", content: "Sign in TRANA" },
      { property: "og:description", content: "Access your TRANA legal first-aid dashboard." },
    ],
  }),
  component: AuthPage,
});

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID ||
  "597312527946-h633qaht8qkc3pa4njid8dijq0tqvbs7.apps.googleusercontent.com";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const dest = redirect ?? "/dashboard/chat";

  // 1. If already signed in via TRANA or Supabase, immediately navigate to destination
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("trana_session_token");
      if (storedToken) {
        navigate({ to: dest, replace: true });
        return;
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest, replace: true });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: dest, replace: true });
    });

    return () => sub.subscription.unsubscribe();
  }, [dest, navigate]);

  // 2. Handle Google ID token received directly on website
  async function handleGoogleCredential(credential: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Google authentication failed on server.");
      }

      const authData = (await res.json()) as { session_token: string; user: Record<string, unknown> };
      if (authData.session_token && authData.user) {
        localStorage.setItem("trana_session_token", authData.session_token);
        localStorage.setItem("trana_user", JSON.stringify(authData.user));
        navigate({ to: dest, replace: true });
      } else {
        throw new Error("Invalid session response received from backend.");
      }
    } catch (exc: unknown) {
      const message = exc instanceof Error ? exc.message : "Failed to sign in with Google.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  // 3. Initialize Google Identity Services script
  useEffect(() => {
    let script = document.getElementById("google-gsi-client") as HTMLScriptElement | null;

    function initGoogle() {
      if (!window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential?: string }) => {
            if (response.credential) {
              void handleGoogleCredential(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "filled_black",
            size: "large",
            width: 380,
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
          });
        }
        setGoogleReady(true);
      } catch (e) {
        console.warn("Failed to initialize Google Sign-In:", e);
      }
    }

    if (!script) {
      script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initGoogle();
    }

    const timer = setTimeout(() => {
      if (window.google?.accounts?.id) initGoogle();
    }, 600);

    return () => clearTimeout(timer);
  }, [dest]);

  function triggerGooglePrompt() {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setErr("Google sign-in is initializing. Please wait a moment and try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <Link to="/" className="font-display text-3xl font-semibold tracking-[0.25em] text-foreground">
          TRANA
        </Link>

        <h1 className="mt-10 font-display text-4xl text-foreground">
          {dest?.includes("lawyer") ? "Counsel Portal" : "Sign in to TRANA"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {dest?.includes("lawyer")
            ? "Sign in with your Google account to access the Advocate Workspace."
            : "Sign in with your Google account to access Legal Chat and First-Aid analysis."}
        </p>

        {/* Google Sign-In Container */}
        <div className="mt-8 flex flex-col items-center justify-center">
          <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
          {!googleReady && (
            <button
              onClick={triggerGooglePrompt}
              disabled={busy}
              type="button"
              className="btn-line w-full flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {busy ? "Connecting..." : "Continue with Google"}
            </button>
          )}
        </div>

        {busy && (
          <p className="mt-4 text-center text-xs text-muted-foreground animate-pulse">
            Authenticating your Google account...
          </p>
        )}

        {err && (
          <div className="mt-4 p-3 border border-destructive/40 bg-destructive/10 text-xs text-destructive rounded">
            {err}
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs leading-relaxed text-muted-foreground">
            TRANA provides legal information and first aid, not legal advice. All conversations and document analyses are encrypted and confidential.
          </p>
        </div>
      </div>
    </div>
  );
}
