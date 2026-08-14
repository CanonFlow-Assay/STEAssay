export type VerdictKind = "Pass" | "Fail" | "Inconclusive" | "ToolFailure";

export type Severity = "blocking" | "advisory";

export interface Position {
  readonly line: number;
  readonly column: number;
}

export interface Finding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly path: string;
  readonly position: Position;
  readonly fingerprint: string;
  readonly baseline: boolean;
}

export interface BaselineEntry {
  readonly fingerprint: string;
  readonly rationale: string;
  readonly reviewedBy: string;
}

export interface SentenceLimitRule {
  readonly maxWords: number;
}

export interface RequirementRule {
  readonly markers: readonly string[];
  readonly modals: readonly string[];
}

/** A process invocation, represented without shell parsing or interpolation. */
export type RequiredCommand = readonly [string, ...string[]];

export interface Policy {
  readonly version: 2;
  readonly profile: "new" | "converge";
  readonly includeGlobs: readonly string[];
  readonly excludedGlobs: readonly string[];
  readonly glossaryPath: string;
  readonly vocabularyPath: string;
  readonly requiredCommands: readonly RequiredCommand[];
  readonly rules: {
    readonly "STE-S01": SentenceLimitRule;
    readonly "STE-S09": RequirementRule;
  };
  readonly baseline: readonly BaselineEntry[];
}

export interface Glossary {
  readonly abbreviations: Readonly<Record<string, string>>;
}

export interface DeprecatedTerm {
  readonly term: string;
  readonly replacement?: string;
}

export interface TerminologyPreference {
  readonly canonical: string;
  readonly inconsistent: readonly string[];
}

export interface Vocabulary {
  readonly bannedTerms: readonly string[];
  readonly deprecatedTerms: readonly DeprecatedTerm[];
  readonly imperativeVerbs: readonly string[];
  readonly terminology: readonly TerminologyPreference[];
}

export interface LoadedConfiguration {
  readonly root: string;
  readonly policy: Policy;
  readonly glossary: Glossary;
  readonly vocabulary: Vocabulary;
  readonly policyPath: string;
  readonly glossaryPath: string;
  readonly vocabularyPath: string;
  readonly policyDigest: string;
  readonly glossaryDigest: string;
  readonly vocabularyDigest: string;
}

export interface ScopeObservation {
  readonly scannedPaths: readonly string[];
  readonly excludedPaths: readonly string[];
  readonly unmatchedGlobs: readonly string[];
  readonly unloadedPaths: readonly string[];
  readonly complete: boolean;
}

export type CommandStatus = "NotRun" | "Passed" | "Failed" | "Unavailable";

export interface CommandReceipt {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly status: CommandStatus;
  readonly exitCode: number | null;
  readonly outputDigest: string | null;
}

export interface Receipt {
  readonly schemaVersion: 2;
  readonly command: "doctor" | "scan" | "verify";
  readonly generatedAt: string;
  readonly tool: { readonly name: "ste-assay"; readonly version: string };
  readonly source: { readonly contentDigest: string | null };
  readonly configuration: {
    readonly policyPath: string | null;
    readonly policyDigest: string | null;
    readonly glossaryPath: string | null;
    readonly glossaryDigest: string | null;
    readonly vocabularyPath: string | null;
    readonly vocabularyDigest: string | null;
    readonly profile: "new" | "converge" | null;
    readonly ruleCatalogDigest: string;
  };
  readonly toolchain: {
    readonly node: string;
    readonly npm: string | null;
  };
  readonly scope: ScopeObservation;
  readonly findings: readonly Finding[];
  readonly findingsDigest: string;
  readonly requiredCommands: readonly CommandReceipt[];
  readonly verdict: VerdictKind;
  readonly authoritative: boolean;
  readonly authorityLimitations: readonly string[];
}

export interface AnalysisResult {
  readonly receipt: Receipt;
  readonly sarif: SarifLog;
}

export interface SarifLog {
  readonly version: "2.1.0";
  readonly $schema: "https://json.schemastore.org/sarif-2.1.0.json";
  readonly runs: readonly SarifRun[];
}

export interface SarifRun {
  readonly tool: {
    readonly driver: {
      readonly name: "STEAssay";
      readonly version: string;
      readonly rules: readonly SarifRule[];
    };
  };
  readonly results: readonly SarifResult[];
}

export interface SarifRule {
  readonly id: string;
  readonly shortDescription: { readonly text: string };
  readonly defaultConfiguration: { readonly level: "error" | "warning" };
}

export interface SarifResult {
  readonly ruleId: string;
  readonly level: "error" | "warning";
  readonly message: { readonly text: string };
  readonly locations: readonly {
    readonly physicalLocation: {
      readonly artifactLocation: { readonly uri: string };
      readonly region: {
        readonly startLine: number;
        readonly startColumn: number;
      };
    };
  }[];
}
