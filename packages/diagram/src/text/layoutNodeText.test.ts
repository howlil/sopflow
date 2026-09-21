import { describe, expect, it } from "vitest";
import { layoutNodeText } from "./layoutNodeText.js";

describe("layoutNodeText", () => {
  it("wraps long labels into multiple lines", () => {
    const result = layoutNodeText(
      "Verifikasi kelengkapan dokumen pengajuan",
      "task",
    );

    expect(result.text.lines.length).toBeGreaterThan(1);
    expect(result.text.lines.join(" ")).toBe(
      "Verifikasi kelengkapan dokumen pengajuan",
    );
  });

  it("increases height for multiline labels", () => {
    const short = layoutNodeText("Review", "task");
    const long = layoutNodeText(
      "Verifikasi seluruh kelengkapan dokumen pengajuan sebelum diteruskan",
      "task",
    );

    expect(long.size.height).toBeGreaterThan(short.size.height);
  });

  it("produces deterministic output", () => {
    const first = layoutNodeText("Dokumen perlu diverifikasi", "decision");
    const second = layoutNodeText("Dokumen perlu diverifikasi", "decision");

    expect(first).toEqual(second);
  });

  it("hard splits words longer than the line limit", () => {
    const result = layoutNodeText("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "task", {
      maxCharsPerLine: 5,
    });

    expect(result.text.lines).toEqual([
      "ABCDE",
      "FGHIJ",
      "KLMNO",
      "PQRST",
      "UVWXY",
      "Z",
    ]);
  });

  it("uses a fallback for blank labels", () => {
    expect(layoutNodeText("   ", "task").text.lines).toEqual(["Tanpa nama"]);
  });

  it("wraps decision labels more narrowly", () => {
    const task = layoutNodeText("123456789012345678", "task");
    const decision = layoutNodeText("123456789012345678", "decision");

    expect(task.text.lines).toHaveLength(1);
    expect(decision.text.lines.length).toBeGreaterThan(1);
  });
});
