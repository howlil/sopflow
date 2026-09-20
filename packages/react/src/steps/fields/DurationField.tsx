import type { Duration } from "@sopflow/core";

import styles from "./DurationField.module.css";

export interface DurationFieldProps {
  value?: Duration | undefined;
  onChange: (value: Duration | undefined) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
}

const UNITS: Array<{
  value: Duration["unit"];
  label: string;
}> = [
  { value: "minute", label: "Menit" },
  { value: "hour", label: "Jam" },
  { value: "day", label: "Hari" },
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
  { value: "year", label: "Tahun" },
];

export function DurationField({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
}: DurationFieldProps) {
  const amount = value === undefined ? "" : String(value.value);
  const unit = value?.unit ?? "minute";

  if (readOnly) {
    return (
      <span className={styles.readonly} data-error={error || undefined}>
        {value ? `${value.value} ${value.unit}` : "—"}
      </span>
    );
  }

  function handleAmountChange(rawValue: string) {
    if (rawValue === "") {
      onChange(undefined);
      return;
    }

    const amount = Number(rawValue);

    if (!Number.isFinite(amount) || amount < 0) {
      return;
    }

    onChange({
      value: amount,
      unit,
    });
  }

  function handleUnitChange(nextUnit: Duration["unit"]) {
    onChange({
      value: value?.value ?? 0,
      unit: nextUnit,
    });
  }

  return (
    <div
      className={styles.field}
      data-empty={!value || undefined}
      data-error={error || undefined}
      data-disabled={disabled || undefined}
    >
      <input
        className={styles.amount}
        type="number"
        min={0}
        step="any"
        value={amount}
        disabled={disabled}
        aria-label="Jumlah waktu"
        placeholder="0"
        onChange={(event) => handleAmountChange(event.target.value)}
      />

      <select
        className={styles.unit}
        value={unit}
        disabled={disabled}
        aria-label="Satuan waktu"
        onChange={(event) =>
          handleUnitChange(event.target.value as Duration["unit"])
        }
      >
        {UNITS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
