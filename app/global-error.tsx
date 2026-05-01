"use client";

/**
 * Replaces the root layout when an error bubbles above `app/error.tsx`.
 * Required full document — see https://nextjs.org/docs/app/api-reference/file-conventions/global-error
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: "0.5rem", maxWidth: "28rem", fontSize: "0.875rem", color: "#a1a1aa" }}>
          {error && typeof error === "object" && "message" in error && typeof (error as Error).message === "string"
            ? (error as Error).message
            : "Something went wrong"}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "2rem",
            borderRadius: "9999px",
            border: "none",
            background: "#fafafa",
            color: "#18181b",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
