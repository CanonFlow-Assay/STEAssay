import { findRule } from "../rules.js";
import type { Glossary, Position, Severity, Vocabulary } from "../model.js";

export class MarkdownParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MarkdownParseError";
  }
}

export interface BrowserScopedFile {
  readonly relativePath: string;
  readonly content: string;
}

export interface AnalysisConfiguration {
  readonly maxWords: number;
  readonly glossary: Glossary;
  readonly vocabulary: Vocabulary;
  readonly requirementMarkers: readonly string[];
  readonly requirementModals: readonly string[];
}

export interface ObservedFinding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly path: string;
  readonly position: Position;
}

interface TextLine {
  readonly line: number;
  readonly column: number;
  readonly text: string;
}

interface ProseBlock {
  readonly text: string;
  readonly lines: readonly TextLine[];
}

interface Sentence {
  readonly text: string;
  readonly position: Position;
}

const wordPattern = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const abbreviationPattern =
  /(?<![\p{L}\p{N}_])[A-Z][A-Z0-9-]{1,}(?![\p{L}\p{N}_])/gu;
const passivePattern =
  /\b(?:am|is|are|was|were|be|been|being)\s+[A-Za-z]+(?:ed|en)\b/iu;

const escapePattern = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const wholeTerm = (term: string): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapePattern(term)}(?![\\p{L}\\p{N}_])`,
    "giu",
  );

const displayName = (path: string): string =>
  path.split(/[\\/]/u).at(-1) ?? path;

const positionFor = (block: ProseBlock, index: number): Position => {
  let offset = 0;
  for (const line of block.lines) {
    const end = offset + line.text.length;
    if (index <= end) {
      return {
        line: line.line,
        column: line.column + Math.max(0, index - offset),
      };
    }
    offset = end + 1;
  }
  const last = block.lines.at(-1);
  return {
    line: last?.line ?? 1,
    column: (last?.column ?? 1) + (last?.text.length ?? 0),
  };
};

const normalizedVisible = (value: string): string =>
  value
    .replace(/!?(?:\[([^\]]*)\]\([^)]*\))/gu, "$1")
    .replace(/[`*_~]/gu, "")
    .trim();

const proseLine = (
  raw: string,
): { readonly text: string; readonly column: number } => {
  const match = /^(?:\s{0,3}(?:[-+*]|\d+[.)])\s+|\s{0,3}>\s?)(.*)$/u.exec(raw);
  if (match !== null) {
    return { text: match[1], column: raw.length - match[1].length + 1 };
  }
  return { text: raw.trim(), column: raw.length - raw.trimStart().length + 1 };
};

const parseMarkdown = (
  file: BrowserScopedFile,
): {
  readonly headings: readonly TextLine[];
  readonly prose: readonly ProseBlock[];
} => {
  if (file.content.includes("\u0000")) {
    throw new MarkdownParseError(
      `${displayName(file.relativePath)} contains a NUL byte; Markdown text cannot be observed safely.`,
    );
  }
  const lines = file.content.split(/\r?\n/u);
  let fence: "`" | "~" | undefined;
  const headings: TextLine[] = [];
  const prose: ProseBlock[] = [];
  let open: TextLine[] = [];
  const flush = (): void => {
    if (open.length > 0) {
      prose.push({
        text: open.map((line) => line.text).join(" "),
        lines: open,
      });
      open = [];
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const lineNumber = index + 1;
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/u.exec(raw);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1][0] as "`" | "~";
      if (fence === undefined) {
        flush();
        fence = marker;
      } else if (fence === marker) {
        fence = undefined;
      }
      continue;
    }
    if (fence !== undefined) {
      continue;
    }
    const atx = /^\s{0,3}#{1,6}(?:[ \t]*(.*?)[ \t]*#*\s*)?$/u.exec(raw);
    if (atx !== null) {
      flush();
      const rawText = atx[1] ?? "";
      headings.push({
        line: lineNumber,
        column: raw.length - rawText.length + 1,
        text: normalizedVisible(rawText),
      });
      continue;
    }
    if (
      /^\s{0,3}(?:=+|-+)\s*$/u.test(raw) &&
      index > 0 &&
      lines[index - 1].trim() !== ""
    ) {
      flush();
      const previous = prose.pop();
      const source = previous?.lines.at(-1);
      if (source !== undefined) {
        headings.push({
          line: source.line,
          column: source.column,
          text: normalizedVisible(source.text),
        });
      }
      continue;
    }
    if (raw.trim() === "") {
      flush();
      continue;
    }
    if (
      /^\s*<!--.*-->\s*$/u.test(raw) ||
      /^\s*<[A-Za-z][^>]*>\s*$/u.test(raw)
    ) {
      flush();
      continue;
    }
    const line = proseLine(raw);
    if (line.text !== "") {
      open.push({ line: lineNumber, column: line.column, text: line.text });
    }
  }
  if (fence !== undefined) {
    throw new MarkdownParseError(
      `${displayName(file.relativePath)} has an unclosed ${fence.repeat(3)} fenced code block.`,
    );
  }
  flush();
  return { headings, prose };
};

const sentencesFor = (block: ProseBlock): readonly Sentence[] => {
  const sentences: Sentence[] = [];
  const pattern = /[^.!?]+(?:[.!?]+|$)/gu;
  for (const match of block.text.matchAll(pattern)) {
    const leading = match[0].search(/\S/u);
    if (leading >= 0) {
      const text = match[0].trim();
      if (text !== "") {
        sentences.push({
          text,
          position: positionFor(block, match.index + leading),
        });
      }
    }
  }
  return sentences;
};

const makeFinding = (
  ruleId: string,
  path: string,
  position: Position,
  message: string,
): ObservedFinding => {
  const rule = findRule(ruleId);
  if (rule === undefined) {
    throw new Error(`Unknown rule: ${ruleId}`);
  }
  return { ruleId, severity: rule.severity, message, path, position };
};

const occurrences = (block: ProseBlock, term: string): readonly Position[] => {
  const pattern = wholeTerm(term);
  const found: Position[] = [];
  for (const match of block.text.matchAll(pattern)) {
    found.push(positionFor(block, match.index));
  }
  return found;
};

const countTerm = (text: string, term: string): number =>
  [...text.matchAll(wholeTerm(term))].length;

export const analyzeMarkdownFiles = (
  files: readonly BrowserScopedFile[],
  configuration: AnalysisConfiguration,
): readonly ObservedFinding[] => {
  const findings: ObservedFinding[] = [];
  for (const file of files) {
    const document = parseMarkdown(file);
    for (const heading of document.headings) {
      if (heading.text === "") {
        findings.push(
          makeFinding(
            "STE-S02",
            file.relativePath,
            heading,
            "Heading has no visible text.",
          ),
        );
      }
    }
    for (const block of document.prose) {
      for (const sentence of sentencesFor(block)) {
        const words = sentence.text.match(wordPattern) ?? [];
        if (words.length > configuration.maxWords) {
          findings.push(
            makeFinding(
              "STE-S01",
              file.relativePath,
              sentence.position,
              `Sentence has ${words.length} word tokens; the configured limit is ${configuration.maxWords}.`,
            ),
          );
        }
        if (passivePattern.test(sentence.text)) {
          findings.push(
            makeFinding(
              "STE-S05",
              file.relativePath,
              sentence.position,
              "Sentence matches the advisory passive-voice pattern.",
            ),
          );
        }
        const imperativeActions =
          configuration.vocabulary.imperativeVerbs.reduce(
            (total, verb) => total + countTerm(sentence.text, verb),
            0,
          );
        if (imperativeActions > 1) {
          findings.push(
            makeFinding(
              "STE-S06",
              file.relativePath,
              sentence.position,
              `Sentence has ${imperativeActions} configured imperative-action tokens.`,
            ),
          );
        }
        const hasMarker = configuration.requirementMarkers.some(
          (marker) => countTerm(sentence.text, marker) > 0,
        );
        const hasModal = configuration.requirementModals.some(
          (modal) => countTerm(sentence.text, modal) > 0,
        );
        if (hasMarker && !hasModal) {
          findings.push(
            makeFinding(
              "STE-S09",
              file.relativePath,
              sentence.position,
              "Configured requirement marker occurs without configured modal language.",
            ),
          );
        }
      }
      for (const match of block.text.matchAll(abbreviationPattern)) {
        const abbreviation = match[0];
        if (!(abbreviation in configuration.glossary.abbreviations)) {
          findings.push(
            makeFinding(
              "STE-S03",
              file.relativePath,
              positionFor(block, match.index),
              `Abbreviation ${abbreviation} is absent from the configured glossary.`,
            ),
          );
        }
      }
      for (const term of configuration.vocabulary.bannedTerms) {
        for (const position of occurrences(block, term)) {
          findings.push(
            makeFinding(
              "STE-S04",
              file.relativePath,
              position,
              `Configured banned term occurs: ${term}.`,
            ),
          );
        }
      }
      for (const deprecated of configuration.vocabulary.deprecatedTerms) {
        for (const position of occurrences(block, deprecated.term)) {
          const replacement =
            deprecated.replacement === undefined
              ? ""
              : ` Use ${deprecated.replacement} instead.`;
          findings.push(
            makeFinding(
              "STE-S08",
              file.relativePath,
              position,
              `Configured deprecated term occurs: ${deprecated.term}.${replacement}`,
            ),
          );
        }
      }
      for (const preference of configuration.vocabulary.terminology) {
        for (const alternative of preference.inconsistent) {
          for (const position of occurrences(block, alternative)) {
            findings.push(
              makeFinding(
                "STE-S10",
                file.relativePath,
                position,
                `Configured noncanonical term occurs: ${alternative}. Prefer ${preference.canonical}.`,
              ),
            );
          }
        }
      }
    }
  }
  return findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.position.line - right.position.line ||
      left.position.column - right.position.column ||
      left.ruleId.localeCompare(right.ruleId),
  );
};
