import type { ReactNode } from "react";
import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "../types.js";
import { InlineDateField } from "./InlineDateField.js";
import { InlineListField } from "./InlineListField.js";
import { InlineTextField } from "./InlineTextField.js";
import { InstitutionEditor } from "./InstitutionEditor.js";
import { SignatoryEditor } from "./SignatoryEditor.js";
import styles from "./SopHeaderEditor.module.css";

export interface SopHeaderEditorProps {
  document: SOPDocument;
  header: SopHeaderValue;
  onChange: (document: SOPDocument) => void;
  onHeaderChange: (header: SopHeaderValue) => void;
  readOnly?: boolean;
}

export function SopHeaderEditor({
  document,
  header,
  onChange,
  onHeaderChange,
  readOnly = false,
}: SopHeaderEditorProps) {
  function updateHeader<K extends keyof SopHeaderValue>(
    key: K,
    value: SopHeaderValue[K],
  ) {
    onHeaderChange({
      ...header,
      [key]: value,
    });
  }

  return (
    <div className={styles.viewport}>
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
              <InstitutionEditor
                name={header.institutionName}
                {...(header.logoUrl !== undefined
                  ? { logoUrl: header.logoUrl }
                  : {})}
                disabled={readOnly}
                onNameChange={(value) => updateHeader("institutionName", value)}
              />
            </th>

            <HeaderLabel>NOMOR SOP</HeaderLabel>
            <Separator />

            <HeaderValue>
              <InlineTextField
                ariaLabel="Nomor SOP"
                value={header.number}
                placeholder="Nomor SOP"
                readOnly={readOnly}
                onChange={(value) => updateHeader("number", value)}
              />
            </HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>TANGGAL PEMBUATAN</HeaderLabel>
            <Separator />

            <HeaderValue>
              <InlineDateField
                ariaLabel="Tanggal pembuatan"
                value={header.createdDate}
                disabled={readOnly}
                onChange={(value) => updateHeader("createdDate", value)}
              />
            </HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>TANGGAL REVISI</HeaderLabel>
            <Separator />

            <HeaderValue>
              <InlineDateField
                ariaLabel="Tanggal revisi"
                value={header.revisionDate}
                disabled={readOnly}
                onChange={(value) => updateHeader("revisionDate", value)}
              />
            </HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>TANGGAL EFEKTIF</HeaderLabel>
            <Separator />

            <HeaderValue>
              <InlineDateField
                ariaLabel="Tanggal efektif"
                value={header.effectiveDate}
                disabled={readOnly}
                onChange={(value) => updateHeader("effectiveDate", value)}
              />
            </HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>DISAHKAN OLEH</HeaderLabel>
            <Separator />

            <HeaderValue>
              <SignatoryEditor
                {...(header.signatory ? { value: header.signatory } : {})}
                disabled={readOnly}
                onChange={(value) => updateHeader("signatory", value)}
              />
            </HeaderValue>
          </tr>

          <tr>
            <HeaderLabel>SOP</HeaderLabel>
            <Separator />

            <HeaderValue>
              <InlineTextField
                ariaLabel="Judul SOP"
                value={document.title}
                placeholder="Judul SOP"
                readOnly={readOnly}
                onChange={(title) => onChange({ ...document, title })}
              />
            </HeaderValue>
          </tr>

          <SectionTitleRow left="DASAR HUKUM" right="KUALIFIKASI PELAKSANAAN" />

          <SectionValueRow
            left={header.lawBasis}
            right={header.qualifications}
            leftLabel="Dasar hukum"
            rightLabel="Kualifikasi pelaksanaan"
            readOnly={readOnly}
            onLeftChange={(value) => updateHeader("lawBasis", value)}
            onRightChange={(value) => updateHeader("qualifications", value)}
          />

          <SectionTitleRow
            left="KETERKAITAN DENGAN SOP LAIN"
            right="PERALATAN / PERLENGKAPAN"
          />

          <SectionValueRow
            left={header.relatedSops}
            right={header.equipment}
            leftLabel="Keterkaitan dengan SOP lain"
            rightLabel="Peralatan / perlengkapan"
            readOnly={readOnly}
            onLeftChange={(value) => updateHeader("relatedSops", value)}
            onRightChange={(value) => updateHeader("equipment", value)}
          />

          <SectionTitleRow left="PERINGATAN" right="PENCATATAN DAN PENDATAAN" />

          <SectionValueRow
            left={header.warnings}
            right={header.records}
            leftLabel="Peringatan"
            rightLabel="Pencatatan dan pendataan"
            readOnly={readOnly}
            onLeftChange={(value) => updateHeader("warnings", value)}
            onRightChange={(value) => updateHeader("records", value)}
          />
        </tbody>
      </table>
    </div>
  );
}

function HeaderLabel({ children }: { children: ReactNode }) {
  return <td className={styles.label}>{children}</td>;
}

function Separator() {
  return <td className={styles.separator}>:</td>;
}

function HeaderValue({ children }: { children: ReactNode }) {
  return <td className={styles.value}> {children}</td>;
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
  leftLabel,
  rightLabel,
  readOnly,
  onLeftChange,
  onRightChange,
}: {
  left: string[];
  right: string[];
  leftLabel: string;
  rightLabel: string;
  readOnly: boolean;
  onLeftChange: (value: string[]) => void;
  onRightChange: (value: string[]) => void;
}) {
  return (
    <tr>
      <td
        className={styles.sectionValue}
        data-empty={left.length === 0 || undefined}
      >
        <InlineListField
          value={left}
          ariaLabel={leftLabel}
          disabled={readOnly}
          onChange={onLeftChange}
        />
      </td>

      <td
        colSpan={3}
        className={styles.sectionValue}
        data-empty={right.length === 0 || undefined}
      >
        <InlineListField
          value={right}
          ariaLabel={rightLabel}
          disabled={readOnly}
          onChange={onRightChange}
        />
      </td>
    </tr>
  );
}
