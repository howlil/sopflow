import { Button } from "../primitives/Button.js";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { SOPDocument } from "@sopflow/core";
import { FormField as Field } from "../primitives/FormField.js";
import { SopInput } from "../primitives/Input.js";
import { Textarea as ArcTextarea } from "../components/arc/textarea/textarea.js";
import { SopDatePicker } from "../components/sop-date-picker/SopDatePicker.js";
import { InspectorSection } from "../primitives/InspectorSection.js";
import type { SopHeaderValue, SopSignatory } from "./types.js";
import styles from "./SopHeaderFields.module.css";

export interface SopHeaderFieldsProps {
  document: SOPDocument;
  header: SopHeaderValue;
  onDocumentChange?: (document: SOPDocument) => void;
  onHeaderChange?: (header: SopHeaderValue) => void;
  disabled?: boolean;
  className?: string;
  highlightedField?: string;
}

export function SopHeaderFields({
  document,
  header,
  onDocumentChange,
  onHeaderChange,
  disabled = false,
  className,
  highlightedField,
}: SopHeaderFieldsProps) {
  const headerDisabled = disabled || !onHeaderChange;
  const documentDisabled = disabled || !onDocumentChange;
  const institutionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoInputId = useId();
  const [logoError, setLogoError] = useState<string | null>(null);

  // Measure the actual wrapped content after controlled updates, including
  // externally loaded documents. A one-row field stays compact until needed.
  useLayoutEffect(() => {
    const fields = [
      [institutionTextareaRef.current, header.institutionName],
      [titleTextareaRef.current, document.title],
    ] as const;
    const measure = () => {
      for (const [field, controlledValue] of fields) {
        if (!field || field.value !== controlledValue) continue;
        field.style.height = "auto";
        const measured = field.scrollHeight;
        const height = Math.max(36, Math.min(144, measured));
        field.style.height = `${height}px`;
        field.style.overflowY = measured > 144 ? "auto" : "hidden";
      }
    };
    measure();

    // A resizable Properties inspector changes line wrapping without changing
    // the controlled value. Observe the field containers, not the document.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    for (const [field] of fields) {
      if (field?.parentElement) observer.observe(field.parentElement);
    }
    return () => observer.disconnect();
  }, [header.institutionName, document.title]);

  function updateHeader<K extends keyof SopHeaderValue>(
    key: K,
    value: SopHeaderValue[K],
  ) {
    if (!onHeaderChange) return;

    onHeaderChange({
      ...header,
      [key]: value,
    });
  }

  function updateSignatory<K extends keyof SopSignatory>(
    key: K,
    value: SopSignatory[K],
  ) {
    const signatory: SopSignatory = header.signatory ?? {
      name: "",
      role: "",
      identifier: "",
    };

    updateHeader("signatory", {
      ...signatory,
      [key]: value,
    });
  }

  return (
    <div
      className={[styles.inspector, className].filter(Boolean).join(" ")}
      data-sopflow-header-fields
      data-sopflow-highlight-field={highlightedField}
    >
      <InspectorSection title="Identitas lembaga">
        <Field label="Nama lembaga">
          <ArcTextarea
            data-sopflow-header-field="institutionName"
            aria-invalid={highlightedField === "institutionName" || undefined}
            ref={institutionTextareaRef}
            compact
            label="Field SOP"
            className={styles.textarea}
            rows={1}
            value={header.institutionName}
            disabled={headerDisabled}
            aria-label="Nama lembaga"
            placeholder="Nama instansi atau lembaga"
            onChange={(event) =>
              updateHeader("institutionName", event.target.value)
            }
          />
        </Field>

        <Field label="Logo instansi">
          <div
            className={styles.filePicker}
            data-disabled={headerDisabled || undefined}
          >
            <input
              id={logoInputId}
              ref={logoInputRef}
              className={styles.fileInput}
              type="file"
              accept="image/*"
              disabled={headerDisabled}
              aria-label="Logo instansi"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;

                if (!file.type.startsWith("image/")) {
                  setLogoError("File logo harus berupa gambar.");
                  event.target.value = "";
                  return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result !== "string") {
                    setLogoError("Logo tidak dapat dibaca.");
                    return;
                  }

                  updateHeader("logoUrl", reader.result);
                  setLogoError(null);
                };
                reader.onerror = () => setLogoError("Logo tidak dapat dibaca.");
                reader.readAsDataURL(file);
              }}
            />
            <label className={styles.fileButton} htmlFor={logoInputId}>
              Pilih logo
            </label>
            <span className={styles.fileName}>
              {header.logoUrl ? "Logo tersimpan" : "Belum ada file"}
            </span>
          </div>
          {header.logoUrl ? (
            <div className={styles.logoPreview}>
              <img
                src={header.logoUrl}
                alt="Pratinjau logo instansi"
                className={styles.logoPreviewImage}
              />
              {!headerDisabled ? (
                <Button
                  variant="ghost"
                  type="button"
                  className={styles.logoRemove}
                  onClick={() => {
                    updateHeader("logoUrl", "");
                    setLogoError(null);
                    if (logoInputRef.current) logoInputRef.current.value = "";
                  }}
                >
                  Hapus logo
                </Button>
              ) : null}
            </div>
          ) : null}
          {logoError ? (
            <p className={styles.fieldError} role="alert">
              {logoError}
            </p>
          ) : null}
        </Field>
      </InspectorSection>

      <InspectorSection title="Identitas SOP">
        <Field label="Nama SOP">
          <ArcTextarea
            data-sopflow-header-field="title"
            aria-invalid={highlightedField === "title" || undefined}
            ref={titleTextareaRef}
            compact
            label="Field SOP"
            className={styles.textarea}
            rows={1}
            value={document.title}
            disabled={documentDisabled}
            aria-label="Nama SOP"
            placeholder="Judul SOP"
            onChange={(event) =>
              onDocumentChange?.({
                ...document,
                title: event.target.value,
              })
            }
          />
        </Field>

        <Field label="Nomor SOP">
          <SopInput
            data-sopflow-header-field="number"
            aria-invalid={highlightedField === "number" || undefined}
            className={styles.input}
            type="text"
            value={header.number}
            disabled={headerDisabled}
            aria-label="Nomor SOP"
            placeholder="Nomor SOP"
            onChange={(event) => updateHeader("number", event.target.value)}
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Tanggal">
        <Field label="Tanggal pembuatan">
          <SopDatePicker
            data-sopflow-header-field="createdDate"
            label="Tanggal pembuatan"
            value={header.createdDate}
            disabled={headerDisabled}
            onValueChange={(value) => updateHeader("createdDate", value)}
          />
        </Field>

        <Field label="Tanggal revisi">
          <SopDatePicker
            data-sopflow-header-field="revisionDate"
            label="Tanggal revisi"
            value={header.revisionDate}
            disabled={headerDisabled}
            onValueChange={(value) => updateHeader("revisionDate", value)}
          />
        </Field>

        <Field label="Tanggal efektif">
          <SopDatePicker
            data-sopflow-header-field="effectiveDate"
            label="Tanggal efektif"
            value={header.effectiveDate}
            disabled={headerDisabled}
            onValueChange={(value) => updateHeader("effectiveDate", value)}
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Pengesahan">
        <Field label="Jabatan">
          <SopInput
            className={styles.input}
            type="text"
            value={header.signatory?.role ?? ""}
            disabled={headerDisabled}
            aria-label="Jabatan"
            placeholder="Jabatan penandatangan"
            onChange={(event) => updateSignatory("role", event.target.value)}
          />
        </Field>

        <Field label="Nama">
          <SopInput
            className={styles.input}
            type="text"
            value={header.signatory?.name ?? ""}
            disabled={headerDisabled}
            aria-label="Nama penandatangan"
            placeholder="Nama penandatangan"
            onChange={(event) => updateSignatory("name", event.target.value)}
          />
        </Field>

        <Field label="Nomor identitas">
          <SopInput
            className={styles.input}
            type="text"
            value={header.signatory?.identifier ?? ""}
            disabled={headerDisabled}
            aria-label="Nomor identitas"
            placeholder="NIP / nomor identitas"
            onChange={(event) =>
              updateSignatory("identifier", event.target.value)
            }
          />
        </Field>
      </InspectorSection>

      <ListSection
        field="lawBasis"
        highlighted={highlightedField === "lawBasis"}
        title="Dasar hukum"
        value={header.lawBasis}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("lawBasis", value)}
      />

      <ListSection
        field="qualifications"
        highlighted={highlightedField === "qualifications"}
        title="Kualifikasi pelaksanaan"
        value={header.qualifications}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("qualifications", value)}
      />

      <ListSection
        field="relatedSops"
        highlighted={highlightedField === "relatedSops"}
        title="Keterkaitan dengan SOP"
        value={header.relatedSops}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("relatedSops", value)}
      />

      <ListSection
        field="equipment"
        highlighted={highlightedField === "equipment"}
        title="Peralatan / perlengkapan"
        value={header.equipment}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("equipment", value)}
      />

      <ListSection
        field="warnings"
        highlighted={highlightedField === "warnings"}
        title="Peringatan"
        value={header.warnings}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("warnings", value)}
      />

      <ListSection
        field="records"
        highlighted={highlightedField === "records"}
        title="Pencatatan dan pendataan"
        value={header.records}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("records", value)}
      />
    </div>
  );
}

function ListSection({
  field,
  title,
  value,
  disabled,
  highlighted,
  onChange,
}: {
  field: string;
  title: string;
  highlighted: boolean;
  value: readonly string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  function updateItem(index: number, nextValue: string) {
    onChange(
      value.map((item, itemIndex) => (itemIndex === index ? nextValue : item)),
    );
  }

  function removeItem(index: number) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <InspectorSection
      title={title}
      actions={
        !disabled ? (
          <Button
            variant="ghost"
            type="button"
            className={styles.addButton}
            aria-label={`Tambah ${title.toLowerCase()}`}
            data-sopflow-header-field={value.length === 0 ? field : undefined}
            aria-invalid={(highlighted && value.length === 0) || undefined}
            onClick={() => onChange([...value, ""])}
          >
            +
          </Button>
        ) : null
      }
    >
      {value.length > 0 ? (
        <div className={styles.list}>
          {value.map((item, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Header list values are positional.
              key={index}
              className={styles.listItem}
            >
              {disabled ? (
                <div className={styles.readOnlyValue}>{item || "—"}</div>
              ) : (
                <textarea
                  className={styles.listInput}
                  rows={1}
                  value={item}
                  aria-label={`${title} ${index + 1}`}
                  data-sopflow-header-field={index === 0 ? field : undefined}
                  aria-invalid={(highlighted && index === 0) || undefined}
                  placeholder={title}
                  onChange={(event) => updateItem(index, event.target.value)}
                />
              )}

              {!disabled ? (
                <Button
                  variant="ghost"
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Hapus ${title.toLowerCase()} ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  ×
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>Belum ada data.</p>
      )}
    </InspectorSection>
  );
}
