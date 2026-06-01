"use client";

// Catches errors thrown inside the root layout itself (e.g. a crash in a
// shared provider or analytics component). Must include its own <html>/<body>
// because the root layout is unavailable when this renders.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#0a0a0a" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 40 }}>🚚</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#999", fontSize: 14, textAlign: "center" }}>
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "12px 24px",
              background: "#E8481C",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
