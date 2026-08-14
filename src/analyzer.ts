import {
  analyzeMarkdownFiles,
  type AnalysisConfiguration,
} from "./core/analyzer.js";
import { canonicalJson, sha256 } from "./canonical.js";
import type { Finding } from "./model.js";
import type { ScopedFile } from "./scope.js";

export { MarkdownParseError } from "./core/analyzer.js";
export type { AnalysisConfiguration } from "./core/analyzer.js";

export const analyzeFiles = (
  files: readonly ScopedFile[],
  configuration: AnalysisConfiguration,
): readonly Finding[] =>
  analyzeMarkdownFiles(files, configuration).map((finding) => ({
    ...finding,
    fingerprint: sha256(
      canonicalJson({
        ruleId: finding.ruleId,
        path: finding.path,
        position: finding.position,
        message: finding.message,
      }),
    ),
    baseline: false,
  }));
