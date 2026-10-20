import type { Actor } from "@sopflow/core";
import { MultiSelect } from "../../components/arc/multi-select/multi-select.js";
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
  const actorLabels = new Map(
    actors.map((actor, index) => [
      actor.id,
      actor.name.trim() || `Pelaksana belum diberi nama ${index + 1}`,
    ]),
  );
  const names = value
    .map((actorId) => actorLabels.get(actorId))
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

  return (
    <MultiSelect
      compact
      selectionMode="single"
      label="Pelaksana"
      placeholder="Pilih pelaksana"
      options={actors.map((actor) => ({
        value: actor.id,
        label: actorLabels.get(actor.id) ?? "Pelaksana tidak tersedia",
      }))}
      value={[...value]}
      maxVisible={1}
      description={
        value.length > 1
          ? "Beberapa pelaksana terdeteksi. Pilih satu pelaksana untuk memperbaiki langkah ini."
          : undefined
      }
      onValueChange={(next) => {
        if (next.length !== 1 || !actors.some((actor) => actor.id === next[0]))
          return;
        onChange(next);
      }}
    />
  );
}

function compactActorLabel(names: readonly string[]): string {
  if (names.length === 0) return "Pilih pelaksana";
  if (names.length === 1) return names[0] ?? "Pilih pelaksana";
  return `${names[0]} +${names.length - 1}`;
}
