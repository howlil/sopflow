import type { ReactNode } from "react";
import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue, SopSignatory } from "./types.js";
import styles from "./SopHeaderView.module.css";

export interface SopHeaderViewProps {
  document: SOPDocument;
  header: SopHeaderValue;
  className?: string;
}

export function SopHeaderView({
  document,
  header,
  className,
}: SopHeaderViewProps) {
  const institutionLines = header.institutionName
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div
      className={[styles.viewport, className].filter(Boolean).join(" ")}
      data-sopflow-header-view
    >
      <table className={styles.header}>
        <colgroup>
          <col className={styles.brandColumn} />
          <col className={styles.labelColumn} />
          <col className={styles.separatorColumn} />
          <col className={styles.valueColumn} />
        </colgroup>

        <tbody>
          <tr>
            <th rowSpan={6} className={styles.brand}>
              <div className={styles.brandContent}>
                <div className={styles.logo}>
                  {header.logoUrl ? (
                    <img
                      src={header.logoUrl}
                      alt=""
                      className={styles.logoImage}
                    />
                  ) : (
                    <span className={styles.logoPlaceholder}>LOGO</span>
                  )}
                </div>

                <div className={styles.institution}>
                  {institutionLines.length > 0 ? (
                    institutionLines.map((line) => (
                      <div key={line} className={styles.institutionLine}>
                        {line}
                      </div>
                    ))
                  ) : (
                    <span className={styles.placeholder}>—</span>
                  )}
                </div>
              </div>
            </th>

            <HeaderLabel>NOMOR SOP</HeaderLabel>
            <Separator />
            <HeaderValue>{displayValue(header.number)}</HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>TANGGAL PEMBUATAN</HeaderLabel>
            <Separator />
            <HeaderValue>{formatDateValue(header.createdDate)}</HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>TANGGAL REVISI</HeaderLabel>
            <Separator />
            <HeaderValue>{formatDateValue(header.revisionDate)}</HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>TANGGAL EFEKTIF</HeaderLabel>
            <Separator />
            <HeaderValue>{formatDateValue(header.effectiveDate)}</HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>DISAHKAN OLEH</HeaderLabel>
            <Separator />
            <HeaderValue>
              <SignatoryView value={header.signatory} />
            </HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>SOP</HeaderLabel>
            <Separator />
            <HeaderValue strong>{displayValue(document.title)}</HeaderValue>
          </tr>

          <SectionTitleRow left="DASAR HUKUM" right="KUALIFIKASI PELAKSANAAN" />
          <SectionValueRow
            left={header.lawBasis}
            right={header.qualifications}
          />

          <SectionTitleRow
            left="KETERKAITAN DENGAN SOP LAIN"
            right="PERALATAN / PERLENGKAPAN"
          />
          <SectionValueRow left={header.relatedSops} right={header.equipment} />

          <SectionTitleRow left="PERINGATAN" right="PENCATATAN DAN PENDATAAN" />
          <SectionValueRow left={header.warnings} right={header.records} />
        </tbody>
      </table>
    </div>
  );
}

function displayValue(value: string): string {
  return value.trim() || "—";
}

function formatDateValue(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) return "—";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (!match) return trimmed;

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function HeaderLabel({ children }: { children: ReactNode }) {
  return <td className={styles.label}>{children}</td>;
}

function Separator() {
  return <td className={styles.separator}>:</td>;
}

function HeaderValue({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <td className={styles.value} data-strong={strong || undefined}>
      {children}
    </td>
  );
}

function SignatoryView({ value }: { value: SopSignatory | undefined }) {
  return (
    <div className={styles.signatory}>
      <div className={styles.signatoryRole}>
        {value?.role?.trim() || "Penanggung Jawab"}
      </div>

      <div className={styles.signatureSpace} aria-hidden />

      <div className={styles.signatoryName}>{value?.name?.trim() || "—"}</div>

      <div className={styles.signatoryIdentifier}>
        {value?.identifier?.trim()
          ? `NIP. ${value.identifier.trim()}`
          : "NIP. —"}
      </div>
    </div>
  );
}

function SectionTitleRow({ left, right }: { left: string; right: string }) {
  return (
    <tr>
      <td className={styles.sectionTitle}>{left}</td>
      <td colSpan={3} className={styles.sectionTitle}>
        {right}
      </td>
    </tr>
  );
}

function SectionValueRow({
  left,
  right,
}: {
  left: readonly string[];
  right: readonly string[];
}) {
  return (
    <tr>
      <td className={styles.sectionValue}>
        <ReadOnlyList value={left} />
      </td>
      <td colSpan={3} className={styles.sectionValue}>
        <ReadOnlyList value={right} />
      </td>
    </tr>
  );
}

function ReadOnlyList({ value }: { value: readonly string[] }) {
  const visibleItems = value.map((item) => item.trim()).filter(Boolean);

  if (visibleItems.length === 0) {
    return <span className={styles.placeholder}>—</span>;
  }

  const occurrences = new Map<string, number>();

  return (
    <ol className={styles.list}>
      {visibleItems.map((item) => {
        const occurrence = (occurrences.get(item) ?? 0) + 1;
        occurrences.set(item, occurrence);

        return <li key={`${item}-${occurrence}`}>{item}</li>;
      })}
    </ol>
  );
}
