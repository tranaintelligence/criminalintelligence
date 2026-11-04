"""
Standalone script to enforce Row Level Security (RLS) across all public tables in Supabase.
Resolves Supabase Security Advisor warnings:
- rls_disabled_in_public (Lint 0013)
- sensitive_columns_exposed (Lint 0023)
"""
import os
import sys
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import text
from database import engine

BACKEND_ONLY_TABLES = [
    "allowed_ips",
    "auth_sessions",
    "chat_attachments",
    "chat_messages",
    "chat_sessions",
    "court_api_keys",
    "founder_emails",
    "gemini_api_key_usage",
    "gemini_api_keys",
    "notification_providers",
    "provider_api_key_usage",
    "provider_api_keys",
    "tracked_cases",
    "users",
]

def audit_and_fix_rls():
    with engine.connect() as conn:
        print("[1/3] Securing backend-only tables...")
        for tbl in BACKEND_ONLY_TABLES:
            try:
                conn.execute(text(f"ALTER TABLE IF EXISTS public.{tbl} ENABLE ROW LEVEL SECURITY;"))
                conn.execute(text(f"REVOKE ALL ON TABLE public.{tbl} FROM anon, authenticated;"))
                print(f"  [OK] {tbl}: RLS enabled & anon/authenticated revoked")
            except Exception as e:
                print(f"  [ERROR] {tbl}: {e}")

        conn.commit()

        print("\n[2/3] Auditing all public schema tables...")
        res = conn.execute(text("""
            SELECT c.relname as table_name, c.relrowsecurity as rls_enabled
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
            ORDER BY c.relname;
        """)).fetchall()

        all_ok = True
        for row in res:
            status = "[OK] RLS Enabled" if row[1] else "[WARN] RLS Disabled"
            print(f"  - {row[0]}: {status}")
            if not row[1]:
                all_ok = False

        print("\n[3/3] Result Summary:")
        if all_ok:
            print("  ALL public tables have Row Level Security enabled!")
            print("  Supabase Advisor checks (rls_disabled_in_public, sensitive_columns_exposed) are RESOLVED.")
        else:
            print("  WARNING: Some tables still have RLS disabled.")
            sys.exit(1)

if __name__ == "__main__":
    audit_and_fix_rls()
