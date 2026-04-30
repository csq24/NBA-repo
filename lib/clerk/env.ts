/**
 * Clerk is optional for local scoreboard browsing: without keys, middleware skips Clerk
 * and the UI omits ClerkProvider. Add keys from the Clerk dashboard to enable auth.
 *
 * Supports `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY` (some CLIs/plugins
 * use the non-public name; `next.config.mjs` also maps it for the client bundle).
 *
 * `CLERK_SECRET_KEY` is read by `@clerk/nextjs` for server / middleware; we normalize it so
 * pasted values with quotes or a UTF-8 BOM still work.
 */
function normalizeClerkEnvValue(raw: string | undefined): string {
  if (!raw) return "";
  let v = raw.trim().replace(/^\uFEFF/, "");
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function getClerkPublishableKey(): string {
  return normalizeClerkEnvValue(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY,
  );
}

/** Server-only API secret (`sk_test_…` / `sk_live_…`). Used by Clerk middleware and server helpers. */
export function getClerkSecretKey(): string {
  return normalizeClerkEnvValue(process.env.CLERK_SECRET_KEY);
}

function looksLikeClerkPublishable(key: string): boolean {
  const k = key.trim();
  if (k.length < 20) return false;
  if (k.includes("NEXT_PUBLIC_CLERK") || k.includes("CLERK_PUBLISHABLE_KEY")) return false;
  return k.startsWith("pk_test_") || k.startsWith("pk_live_");
}

function looksLikeClerkSecret(key: string): boolean {
  const k = key.trim();
  if (k.length < 30) return false;
  if (k === "CLERK_SECRET_KEY") return false;
  return k.startsWith("sk_test_") || k.startsWith("sk_live_");
}

export function hasClerkConfigured(): boolean {
  const publishable = getClerkPublishableKey();
  const secret = getClerkSecretKey();
  if (!publishable || !secret) return false;
  if (!looksLikeClerkPublishable(publishable) || !looksLikeClerkSecret(secret)) return false;
  return true;
}
