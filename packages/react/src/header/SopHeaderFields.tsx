import type { ReactNode } from "react";
import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue, SopSignatory } from "../types.js";
import styles from "./SopHeaderFields.module.css";

export interface SopHeaderFieldsProps {
  document: SOPDocument;
  header: SopHeaderValue;
  onDocumentChange?: (document: SOPDocument) => void;
  onHeaderChange?: (header: SopHeaderValue) => void;
  disabled?: boolean;
  className?: string;
}

export function SopHeaderFields({
  document,
  header,
  onDocumentChange,
  onHeaderChange,
  disabled = false,
  className,
}: SopHeaderFieldsProps) {
  const headerDisabled = disabled || !onHeaderChange;
  const documentDisabled = disabled || !onDocumentChange;

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
    >
      <InspectorSection title="Identitas lembaga">
        <Field label="Nama lembaga">
          <textarea
            className={styles.textarea}
            rows={3}
            value={header.institutionName}
            disabled={headerDisabled}
            placeholder="Nama instansi atau lembaga"
            onChange={(event) =>
              updateHeader("institutionName", event.target.value)
            }
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Identitas SOP">
        <Field label="Nama SOP">
          <textarea
            className={styles.textarea}
            rows={2}
            value={document.title}
            disabled={documentDisabled}
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
          <input
            className={styles.input}
            type="text"
            value={header.number}
            disabled={headerDisabled}
            placeholder="Nomor SOP"
            onChange={(event) => updateHeader("number", event.target.value)}
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Tanggal">
        <Field label="Tanggal pembuatan">
          <input
            className={styles.input}
            type="date"
            value={header.createdDate}
            disabled={headerDisabled}
            onChange={(event) =>
              updateHeader("createdDate", event.target.value)
            }
          />
        </Field>

        <Field label="Tanggal revisi">
          <input
            className={styles.input}
            type="date"
            value={header.revisionDate}
            disabled={headerDisabled}
            onChange={(event) =>
              updateHeader("revisionDate", event.target.value)
            }
          />
        </Field>

        <Field label="Tanggal efektif">
          <input
            className={styles.input}
            type="date"
            value={header.effectiveDate}
            disabled={headerDisabled}
            onChange={(event) =>
              updateHeader("effectiveDate", event.target.value)
            }
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Pengesahan">
        <Field label="Jabatan">
          <input
            className={styles.input}
            type="text"
            value={header.signatory?.role ?? ""}
            disabled={headerDisabled}
            placeholder="Jabatan penandatangan"
            onChange={(event) => updateSignatory("role", event.target.value)}
          />
        </Field>

        <Field label="Nama">
          <input
            className={styles.input}
            type="text"
            value={header.signatory?.name ?? ""}
            disabled={headerDisabled}
            placeholder="Nama penandatangan"
            onChange={(event) => updateSignatory("name", event.target.value)}
          />
        </Field>

        <Field label="Nomor identitas">
          <input
            className={styles.input}
            type="text"
            value={header.signatory?.identifier ?? ""}
            disabled={headerDisabled}
            placeholder="NIP / nomor identitas"
            onChange={(event) =>
              updateSignatory("identifier", event.target.value)
            }
          />
        </Field>
      </InspectorSection>

      <ListSection
        title="Dasar hukum"
        value={header.lawBasis}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("lawBasis", value)}
      />

      <ListSection
        title="Kualifikasi pelaksanaan"
        value={header.qualifications}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("qualifications", value)}
      />

      <ListSection
        title="Keterkaitan dengan SOP"
        value={header.relatedSops}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("relatedSops", value)}
      />

      <ListSection
        title="Peralatan / perlengkapan"
        value={header.equipment}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("equipment", value)}
      />

      <ListSection
        title="Peringatan"
        value={header.warnings}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("warnings", value)}
      />

      <ListSection
        title="Pencatatan dan pendataan"
        value={header.records}
        disabled={headerDisabled}
        onChange={(value) => updateHeader("records", value)}
      />
    </div>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function ListSection({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: readonly string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  function updateItem(index: number, nextValue: string) {
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index ? nextValue : item,
      ),
    );
  }

  function removeItem(index: number) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 className={styles.sectionTitle}>{title}</h2>

        {!disabled ? (
          <button
            type="button"
            className={styles.addButton}
            aria-label={`Tambah ${title.toLowerCase()}`}
            onClick={() => onChange([...value, ""])}
          >
            +
          </button>
        ) : null}
      </div>

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
                  placeholder={title}
                  onChange={(event) => updateItem(index, event.target.value)}
                />
              )}

              {!disabled ? (
                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Hapus ${title.toLowerCase()} ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>Belum ada data.</p>
      )}
    </section>
  );
}
