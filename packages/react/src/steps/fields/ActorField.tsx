import type { Actor } from "@sopflow/core";

import styles from "./ActorField.module.css";

export interface ActorFieldProps {
  value: readonly string[];
  actors: readonly Actor[];
  onChange: (actorIds: string[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
}

export function ActorField({
  value,
  actors,
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
}: ActorFieldProps) {
  const names = value
    .map((actorId) => actors.find((actor) => actor.id === actorId)?.name)
    .filter((name): name is string => Boolean(name));

  if (readOnly) {
    return (
      <span className={styles.readonly} data-error={error || undefined}>
        {names.length > 0 ? names.join(", ") : "—"}
      </span>
    );
  }

  if (disabled) {
    return (
      <span className={styles.disabled} data-error={error || undefined}>
        {compactActorLabel(names)}
      </span>
    );
  }

  const selected = new Set(value);

  return (
    <details className={styles.dropdown} data-error={error || undefined}>
      <summary
        className={styles.trigger}
        aria-label="Pelaksana"
        data-sopflow-actor-trigger
        title={names.join(", ") || "Pilih pelaksana"}
      >
        <span className={styles.summaryText}>{compactActorLabel(names)}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </summary>

      <fieldset className={styles.options} aria-label="Pilih pelaksana">
        <legend className={styles.srOnly}>Pilih pelaksana</legend>

        {actors.length === 0 ? (
          <span className={styles.empty}>Belum ada pelaksana.</span>
        ) : (
          actors.map((actor) => {
            const checked = selected.has(actor.id);

            return (
              <label key={actor.id} className={styles.option}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={checked}
                  aria-label={actor.name}
                  onChange={(event) => {
                    const next = new Set(value);

                    if (event.target.checked) {
                      next.add(actor.id);
                    } else {
                      next.delete(actor.id);
                    }

                    onChange(
                      actors
                        .map((candidate) => candidate.id)
                        .filter((actorId) => next.has(actorId)),
                    );
                  }}
                />
                <span className={styles.optionLabel}>{actor.name}</span>
              </label>
            );
          })
        )}
      </fieldset>
    </details>
  );
}

function compactActorLabel(names: readonly string[]): string {
  if (names.length === 0) return "Pilih pelaksana";
  if (names.length === 1) return names[0] ?? "Pilih pelaksana";

  return `${names[0]} +${names.length - 1}`;
}
