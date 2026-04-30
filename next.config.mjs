/** @type {import('next').NextConfig} */

/** Read first defined non-empty env (Supabase/Clerk CLIs and IDE plugins often omit `NEXT_PUBLIC_`). */
function firstEnv(...names) {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

const bridgedPublicEnv = {};
const supabaseUrl = firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const supabaseAnon = firstEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
const clerkPublishable = firstEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_PUBLISHABLE_KEY");
if (supabaseUrl) bridgedPublicEnv.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
if (supabaseAnon) bridgedPublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnon;
if (clerkPublishable) bridgedPublicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkPublishable;

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: bridgedPublicEnv,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
