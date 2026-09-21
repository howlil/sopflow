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
  if (readOnly) {
    const names = value
      .map((actorId) => actors.find((actor) => actor.id === actorId)?.name)
      .filter((name): name is string => Boolean(name));

    return (
      <span className={styles.readonly} data-error={error || undefined}>
        {names.length > 0 ? names.join(", ") : "—"}
      </span>
    );
  }

  const selected = new Set(value);

  return (
    <fieldset
      className={styles.group}
      data-error={error || undefined}
      aria-label="Pelaksana"
      disabled={disabled}
    >
      <legend className={styles.srOnly}>Pelaksana</legend>

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
  );
}
