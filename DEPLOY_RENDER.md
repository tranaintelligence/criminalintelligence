# TRANA Unified Deployment Guide (Render + Vercel)

This repository is unified: both the **Python FastAPI Backend** and the **TanStack Start Frontend** live together in this repository.

- **Backend**: Deployed on [Render](https://render.com) (Python 3)
- **Frontend**: Deployed on [Vercel](https://vercel.com) (Vite / React / TanStack)
- **Database**: Managed on [Supabase](https://supabase.com) (PostgreSQL)
- **Authentication**: Supabase Auth with Google OAuth, native TRANA sessions, and dev-mode support.

---

## 1. Deploy the Backend on Render

1. Open the [Render Dashboard](https://dashboard.render.com) and click **New -> Web Service** (or **New -> Blueprint**).
2. Connect your GitHub repository (`tranaintelligence/criminalintelligence`) on `main`.
3. If creating via Blueprint:
   - Render reads `render.yaml` automatically.
4. If creating manually as Web Service:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
5. Configure the following Environment Variables in Render:
   - `GEMINI_API_KEY`: Primary Google Gemini API key.
   - `GEMINI_API_KEY_FALLBACK`, `GEMINI_API_KEY_3`, `GEMINI_API_KEY_4`: Optional rotation keys.
   - `GROQ_API_KEY`, `CEREBRAS_API_KEY`: Optional fast Quick Thinking providers.
   - `ADMIN_EMAILS`: Comma-separated admin emails (e.g. `founder@trana.in,your-email@gmail.com`).
   - `API_KEY_ENCRYPTION_KEY`: Fernet 32-byte key for encrypting provider keys. Generate with:
     ```powershell
     python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
     ```
   - `DATABASE_URL`: Hosted Supabase PostgreSQL connection string (e.g. `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`).
   - `GOOGLE_CLIENT_ID`: Google OAuth Web Client ID.
   - `SUPABASE_JWT_SECRET`: Optional Supabase JWT secret from Supabase Dashboard -> Project Settings -> API.
6. Open `/health` on your Render URL to confirm `status` is `healthy` and `source_registry_ready` is `true`.

---

## 2. Deploy the Frontend on Vercel

1. Open [Vercel Dashboard](https://vercel.com) and click **Add New -> Project**.
2. Import `tranaintelligence/criminalintelligence`.
3. Root Directory: `./` (root).
4. Framework Preset: **Vite** or Other.
5. Build Command: `npm run build` (or `bun run build`).
6. Output Directory: `.output` (or `dist` / default).
7. Environment Variables in Vercel:
   - `VITE_TRANA_BACKEND_URL`: URL of your Render backend without trailing slash (e.g. `https://criminalintelligence.onrender.com`).
   - `VITE_BACKEND_URL`: Same as above.
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase Publishable / Anon Key.
   - `VITE_SUPABASE_PROJECT_ID`: Your Supabase Project ID.
8. Deploy!

---

## 3. Data Flow & Authentication Architecture

The application seamlessly bridges Supabase Auth and the FastAPI backend:
1. When a user signs in via Google OAuth or email in the frontend:
   - Supabase issues an access token (`session.access_token`).
   - The frontend passes this token via `Authorization: Bearer <token>`.
2. The FastAPI backend verifies the caller in `get_current_user_email`:
   - Checks if it's a hashed TRANA session token in `auth_sessions`.
   - Checks if it's a Supabase JWT and validates email / expiration, upserting the user into `users`.
   - Checks if it's a Google ID token from Google OAuth.
   - Checks if it's a `dev-token` (in local testing).
3. Admin endpoints (`/api/admin/*` and UI at `/founders/admin` or `/admin`):
   - Only allow emails listed in `ADMIN_EMAILS` (and `founder@trana.in`).
   - Allow adding/editing/testing keys for Groq, Cerebras, Google, and custom OpenAI-compatible endpoints with rotation orders and minute/daily telemetry tracking.

---

## 4. Statutory Source Verification

- TRANA references Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS), and Bharatiya Sakshya Adhiniyam (BSA).
- Exact statutory provisions are deterministically verified against `legal_sources/corpus.json`.
- Citations display official Ministry of Home Affairs (MHA) verified links in the chat bubbles.
