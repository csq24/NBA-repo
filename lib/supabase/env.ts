function looksLikeSupabaseUrl(url: string): boolean {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return false;
  // Reject copy-paste mistakes: env var name pasted as the value
  if (u.includes("NEXT_PUBLIC_SUPABASE") || u.includes("your-project")) return false;
  return true;
}

function looksLikeSupabaseAnonKey(key: string): boolean {
  const k = key.trim();
  if (k.length < 32) return false;
  if (k.includes("NEXT_PUBLIC_SUPABASE") || k.toLowerCase().includes("your_anon")) return false;
  // Secret keys must never be used as the browser anon key
  if (k.startsWith("sb_secret_")) return false;
  return true;
}

function resolveSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
}

function resolveSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function getSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} | null {
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();
  if (!url || !anonKey) {
    return null;
  }
  if (!looksLikeSupabaseUrl(url) || !looksLikeSupabaseAnonKey(anonKey)) {
    return null;
  }
  return { url, anonKey };
}

export function requireSupabasePublicEnv(): { url: string; anonKey: string } {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local (Supabase project Settings → API)."
    );
  }
  return env;
}

/** Safe diagnostics for logs and UI (no secrets). */
export type SupabaseEnvDiagnostics = {
  ready: boolean;
  urlSet: boolean;
  anonKeySet: boolean;
  urlValid: boolean;
  anonKeyValid: boolean;
  /** Hostname only when URL is valid */
  urlHost: string | null;
  hints: string[];
};

export function getSupabaseEnvDiagnostics(): SupabaseEnvDiagnostics {
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();
  const urlSet = Boolean(url);
  const anonKeySet = Boolean(anonKey);
  const urlValid = urlSet && looksLikeSupabaseUrl(url);
  const anonKeyValid = anonKeySet && looksLikeSupabaseAnonKey(anonKey);
  const ready = urlValid && anonKeyValid;

  let urlHost: string | null = null;
  if (urlValid) {
    try {
      urlHost = new URL(url).hostname;
    } catch {
      urlHost = null;
    }
  }

  const hints: string[] = [];
  if (!urlSet) {
    hints.push("Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in .env.local");
  } else if (!urlValid) {
    hints.push(
      "SUPABASE_URL must be a full https URL (e.g. https://xxxx.supabase.co), not a placeholder or variable name",
    );
  }
  if (!anonKeySet) {
    hints.push("Set NEXT_PUBLIC_SUPABASE_ANON_KEY with the project's anon public key from Supabase → Settings → API");
  } else if (!anonKeyValid) {
    hints.push(
      "Anon key is too short, looks like a placeholder, uses sb_secret_*, or is invalid — use the long anon public JWT",
    );
  }

  return {
    ready,
    urlSet,
    anonKeySet,
    urlValid,
    anonKeyValid,
    urlHost,
    hints,
  };
}
