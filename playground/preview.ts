import {
  analyzeMarkdownFiles,
  wholeTerm,
  type AnalysisConfiguration,
  type ObservedFinding,
} from "../src/core/analyzer.js";
import type { DeprecatedTerm, TerminologyPreference } from "../src/model.js";

export const ANALYZER_VERSION = "0.1.0";

export type PlaygroundPolicy = AnalysisConfiguration;

export interface SafeCorrection {
  readonly ruleId: "STE-S08" | "STE-S10";
  readonly from: string;
  readonly to: string;
}

export interface PreviewFinding extends ObservedFinding {
  readonly excerpt: string;
  readonly correction?: SafeCorrection;
  readonly manualInstruction: string;
}

export interface PreviewResult {
  readonly findings: readonly PreviewFinding[];
  readonly blockingCount: number;
  readonly advisoryCount: number;
  readonly correctedMarkdown: string;
}

export interface ExpectedPreview {
  readonly ruleIds: readonly string[];
  readonly blockingCount: number;
  readonly advisoryCount: number;
}

const correctionForDeprecated = (
  finding: ObservedFinding,
  terms: readonly DeprecatedTerm[],
): SafeCorrection | undefined => {
  if (finding.ruleId !== "STE-S08") return undefined;
  const entry = terms.find(
    (item) =>
      item.replacement !== undefined &&
      finding.message ===
        `Configured deprecated term occurs: ${item.term}. Use ${item.replacement} instead.`,
  );
  return entry?.replacement === undefined
    ? undefined
    : { ruleId: "STE-S08", from: entry.term, to: entry.replacement };
};

const correctionForTerminology = (
  finding: ObservedFinding,
  terminology: readonly TerminologyPreference[],
): SafeCorrection | undefined => {
  if (finding.ruleId !== "STE-S10") return undefined;
  for (const preference of terminology) {
    for (const alternative of preference.inconsistent) {
      if (
        finding.message ===
        `Configured noncanonical term occurs: ${alternative}. Prefer ${preference.canonical}.`
      ) {
        return {
          ruleId: "STE-S10",
          from: alternative,
          to: preference.canonical,
        };
      }
    }
  }
  return undefined;
};

const manualInstruction = (finding: ObservedFinding): string => {
  switch (finding.ruleId) {
    case "STE-S01":
      return "Shorten or split this sentence manually.";
    case "STE-S02":
      return "Add visible text to this heading manually.";
    case "STE-S03":
      return "Define the abbreviation in the local glossary or rewrite it manually.";
    case "STE-S04":
      return "Remove or replace this configured banned term manually; no replacement is guessed.";
    case "STE-S05":
      return "Review and rewrite this passive-looking construction manually if needed.";
    case "STE-S06":
      return "Use one configured imperative action per sentence, or rewrite manually.";
    case "STE-S08":
      return "Use the configured replacement when one is supplied; otherwise rewrite manually.";
    case "STE-S09":
      return "Add configured modal language or rewrite the requirement manually.";
    case "STE-S10":
      return "Use the configured canonical term manually.";
    default:
      return "Review this observed finding manually.";
  }
};

const excerptFor = (markdown: string, finding: ObservedFinding): string =>
  markdown.split(/\r?\n/u)[finding.position.line - 1] ?? "";

const correctionsFor = (
  policy: PlaygroundPolicy,
): readonly SafeCorrection[] => {
  const replacements: SafeCorrection[] = [];
  for (const entry of policy.vocabulary.deprecatedTerms) {
    if (entry.replacement !== undefined) {
      replacements.push({
        ruleId: "STE-S08",
        from: entry.term,
        to: entry.replacement,
      });
    }
  }
  for (const preference of policy.vocabulary.terminology) {
    for (const alternative of preference.inconsistent) {
      replacements.push({
        ruleId: "STE-S10",
        from: alternative,
        to: preference.canonical,
      });
    }
  }
  const unique = new Map<string, SafeCorrection>();
  for (const correction of replacements) {
    if (!unique.has(correction.from.toLowerCase())) {
      unique.set(correction.from.toLowerCase(), correction);
    }
  }
  return [...unique.values()].sort(
    (left, right) =>
      right.from.length - left.from.length ||
      left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to),
  );
};

export const applySafeCorrections = (
  markdown: string,
  policy: PlaygroundPolicy,
): string =>
  correctionsFor(policy).reduce(
    (corrected, correction) =>
      corrected.replace(wholeTerm(correction.from), correction.to),
    markdown,
  );

export const previewMarkdown = (
  markdown: string,
  policy: PlaygroundPolicy,
): PreviewResult => {
  const rawFindings = analyzeMarkdownFiles(
    [{ relativePath: "playground.md", content: markdown }],
    policy,
  );
  const findings = rawFindings.map((finding) => {
    const correction =
      correctionForDeprecated(finding, policy.vocabulary.deprecatedTerms) ??
      correctionForTerminology(finding, policy.vocabulary.terminology);
    return {
      ...finding,
      excerpt: excerptFor(markdown, finding),
      correction,
      manualInstruction: manualInstruction(finding),
    };
  });
  return {
    findings,
    blockingCount: findings.filter((finding) => finding.severity === "blocking")
      .length,
    advisoryCount: findings.filter((finding) => finding.severity === "advisory")
      .length,
    correctedMarkdown: applySafeCorrections(markdown, policy),
  };
};

export const matchesExpectedPreview = (
  result: PreviewResult,
  expected: ExpectedPreview,
): boolean => {
  const observedRuleIds = result.findings
    .map((finding) => finding.ruleId)
    .sort((left, right) => left.localeCompare(right));
  const expectedRuleIds = [...expected.ruleIds].sort((left, right) =>
    left.localeCompare(right),
  );
  return (
    result.blockingCount === expected.blockingCount &&
    result.advisoryCount === expected.advisoryCount &&
    JSON.stringify(observedRuleIds) === JSON.stringify(expectedRuleIds)
  );
};
