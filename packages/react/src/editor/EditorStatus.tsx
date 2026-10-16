import { Alert } from "../components/arc/alert/alert.js";
import styles from "./EditorStatus.module.css";
import { useEffect, useState } from "react";

export interface EditorStatusProps {
  loading?: boolean;
  error?: string | null;
}

export function EditorStatus({
  loading = false,
  error = null,
}: EditorStatusProps) {
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) {
      setDismissedError(null);
    }
  }, [error]);

  const visibleError = error && error !== dismissedError ? error : null;

  if (!loading && !visibleError) {
    return null;
  }

  return (
    <div className={styles.root} aria-live="polite">
      {loading ? (
        <div className={styles.loading} role="status">
          Memuat perubahan…
        </div>
      ) : null}

      {visibleError ? (
        <Alert
          tone="danger"
          title="Kesalahan editor"
          dismissLabel="Tutup pesan error"
          open
          onDismiss={() => setDismissedError(visibleError)}
        >
          {visibleError}
        </Alert>
      ) : null}
    </div>
  );
}
