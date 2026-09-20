import styles from "./EditorStatus.module.css";

export interface EditorStatusProps {
  loading?: boolean;
  error?: string | null;
}

export function EditorStatus({
  loading = false,
  error = null,
}: EditorStatusProps) {
  if (!loading && !error) {
    return null;
  }

  return (
    <div className={styles.root} aria-live="polite">
      {loading ? (
        <div className={styles.loading} role="status">
          Memuat perubahan…
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
