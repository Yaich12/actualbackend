import React from "react";
import {
  effectiveUseFallbackConfig,
  firebaseConfigured,
  firebaseEnvMissingKeys,
  shouldUseEmulators,
} from "../firebase";

export default function FirebaseEnvNotice() {
  // Don't show banner if Firebase is configured OR if emulators are enabled
  if (firebaseConfigured || shouldUseEmulators) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        background: "#111827",
        color: "#fff",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        fontSize: 13,
        lineHeight: 1.35,
      }}
      role="alert"
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Firebase is not configured for this environment.
      </div>
      <div style={{ opacity: 0.9 }}>
        Missing env vars:{" "}
        <code style={{ color: "#FDE68A" }}>
          {firebaseEnvMissingKeys.join(", ")}
        </code>
        . Add them to a <code style={{ color: "#FDE68A" }}>.env</code> file and
        restart the dev server, or set{" "}
        <code style={{ color: "#FDE68A" }}>
          REACT_APP_USE_FIREBASE_EMULATORS=true
        </code>
        . (App is currently using{" "}
        <code style={{ color: "#FDE68A" }}>
          {effectiveUseFallbackConfig ? "fallback-config" : "cloud-config"}
        </code>
        .)
      </div>
    </div>
  );
}

