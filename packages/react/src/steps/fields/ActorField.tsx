import { ChevronDown } from "lucide-react";
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
      <span className={styles.disabled} data-error={e  return (
    <MultiSelect
      compact
      label="Pelaksana"
      placeholder="Pilih pelaksana"
      options={actors.map((actor) => ({ value: actor.id, label: actor.name }))}
      value={[...value]}
      maxVisible={1}
      onValueChange={(next) => {
        const selected = new Set(next);
        onChange(actors.map((actor) => actor.id).filter((id) => selected.has(id)));
      }}
    />
  );bel>
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
