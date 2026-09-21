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
  const selectedId = value[0] ?? "";

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

  return (
    <select
      className={styles.select}
      value={selectedId}
      disabled={disabled}
      data-empty={!selectedId || undefined}
      data-error={error || undefined}
      aria-label="Pelaksana"
      onChange={(event) => {
        const actorId = event.target.value;

        onChange(actorId ? [actorId] : []);
      }}
    >
      <option value="">Pilih pelaksana</option>

      {actors.map((actor) => (
        <option key={actor.id} value={actor.id}>
          {actor.name}
        </option>
      ))}
    </select>
  );
}
