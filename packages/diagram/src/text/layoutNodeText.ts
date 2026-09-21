import type {
  DiagramNodeKind,
  DiagramSize,
  DiagramTextLayout,
} from "../types.js";

export interface NodeTextLayout {
  text: DiagramTextLayout;
  size: DiagramSize;
}

export interface NodeTextLayoutOptions {
  maxCharsPerLine?: number;
  lineHeight?: number;
  horizontalPadding?: number;
  verticalPadding?: number;
  minWidth?: number;
  maxWidth?: number;
}

const DEFAULTS = {
  maxCharsPerLine: 22,
  lineHeight: 18,
  horizontalPadding: 24,
  verticalPadding: 20,
  minWidth: 128,
  maxWidth: 200,
} as const;

export function layoutNodeText(
  label: string,
  kind: DiagramNodeKind,
  options: NodeTextLayoutOptions = {},
): NodeTextLayout {
  const config = { ...DEFAULTS, ...options };
  const maxCharsPerLine = Math.max(1, Math.floor(config.maxCharsPerLine));
  const adjustedMaxChars =
    kind === "decision" ? Math.max(12, maxCharsPerLine - 5) : maxCharsPerLine;
  const lines = wrapText(label.trim() || "Tanpa nama", adjustedMaxChars);
  const width = getBaseWidth(kind, config);
  const height = Math.max(
    getMinimumHeight(kind),
    lines.length * config.lineHeight + config.verticalPadding * 2,
  );

  return {
    text: { lines, lineHeight: config.lineHeight },
    size: { width, height },
  };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text
    .split(/\s+/)
    .flatMap((word) =>
      word.length > maxChars ? splitLongWord(word, maxChars) : [word],
    );
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function splitLongWord(word: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let index = 0; index < word.length; index += maxChars) {
    parts.push(word.slice(index, index + maxChars));
  }
  return parts;
}

function getBaseWidth(
  kind: DiagramNodeKind,
  config: Required<NodeTextLayoutOptions>,
): number {
  const width = kind === "decision" ? 176 : kind === "task" ? 180 : 144;
  return Math.min(config.maxWidth, Math.max(config.minWidth, width));
}

function getMinimumHeight(kind: DiagramNodeKind): number {
  switch (kind) {
    case "decision":
      return 96;
    case "task":
      return 64;
    case "start":
    case "end":
      return 56;
  }
}
