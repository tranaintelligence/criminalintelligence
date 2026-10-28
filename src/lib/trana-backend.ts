const configuredApiUrl = (
  import.meta.env.VITE_TRANA_BACKEND_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  ''
).trim().replace(/\/+$/, '');

const productionApiUrl = 'https://criminalintelligence.onrender.com';

// Long-running Gemini requests go directly to the Render backend.
export const API_URL = configuredApiUrl || productionApiUrl;

export const CHAT_API_URL = API_URL;
