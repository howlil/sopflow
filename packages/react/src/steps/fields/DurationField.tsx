import type { Duration } from "@sopflow/core";
import { useState } from "react";
import { Select as ArcSelect } from "../../components/arc/select/select.js";

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
  const [emptyUnit, setEmptyUnit] = useState<Duration["unit"]>("minute");
  const amount = value === undefined ? "" : String(value.value);
  const unit = value?.unit ?? emptyUnit;

  if (readOnly) {
    return (
      <span className={styles.readonly} data-error={error || undefined}>
        {value ? `${value.value} ${value.unit}` : "—"}
      </span>
    );
  }

  function handleAmountChange(rawValue: string) {
    if (rawValue === "") {
      setEmptyUnit(unit);
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
    setEmptyUnit(nextUnit);
    // A unit choice alone must not synthesize a zero-duration domain value.
    if (value !== undefined) onChange({ ...value, unit: nextUnit });
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

      <div className={styles.picker}>
        <ArcSelect
          compact
          label="Satuan waktu"
          value={unit}
          disabled={disabled}
          options={UNITS}
          onValueChange={(next) => handleUnitChange(next as Duration["unit"])}
        />
      </div>
    </div>
  );
}
