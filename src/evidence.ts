import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { relative, resolve } from "node:path";
import { analyzeFiles, MarkdownParseError } from "./analyzer.js";
import { canonicalJson, normalizePath, sha256 } from "./canonical.js";
import { catalogDigest, ruleCatalog } from "./catalog.js";
import type {
  AnalysisResult,
  CommandReceipt,
  Finding,
  LoadedConfiguration,
  Receipt,
  RequiredCommand,
  SarifLog,
  ScopeObservation,
  VerdictKind,
} from "./model.js";
import { ConfigurationError, loadConfiguration } from "./policy.js";
import { observeScope, resolveTarget } from "./scope.js";

const TOOL_VERSION = "0.1.0";

const emptyScope = (): ScopeObservation => ({
  scannedPaths: [],
  excludedPaths: [],
  unmatchedGlobs: [],
  unloadedPaths: [],
  complete: false,
});

const clock = (): string => {
  const controlled = process.env.STE_ASSAY_CLOCK;
  if (controlled !== undefined) {
    const parsed = new Date(controlled);
    if (Number.isNaN(parsed.valueOf())) {
      throw new Error("STE_ASSAY_CLOCK must be an ISO-8601 timestamp.");
    }
    return parsed.toISOString();
  }
  return new Date().toISOString();
};

const npmVersion = (): string | null => {
  const agent = process.env.npm_config_user_agent;
  const match =
    agent === undefined ? undefined : /(?:^|\s)npm\/(\S+)/u.exec(agent);
  return match?.[1] ?? null;
};

const sourceDigest = (
  files: readonly { readonly relativePath: string; readonly content: string }[],
): string =>
  sha256(
    canonicalJson(
      files
        .map((file) => ({
          path: file.relativePath,
          contentDigest: sha256(file.content),
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    ),
  );

const displayCommand = (command: RequiredCommand): string =>
  canonicalJson(command);

const commandReceipt = async (
  command: RequiredCommand,
  cwd: string,
): Promise<CommandReceipt> =>
  new Promise((resolveReceipt) => {
    const [executable, ...arguments_] = command;
    const child = spawn(executable, arguments_, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.on("error", (error) => {
      resolveReceipt({
        executable,
        arguments: arguments_,
        status: "Unavailable",
        exitCode: null,
        outputDigest: sha256(error.message),
      });
    });
    child.on("close", (code) => {
      const unavailable =
        code === 127 || /(?:not found|is not recognized as)/iu.test(output);
      resolveReceipt({
        executable,
        arguments: arguments_,
        status: code === 0 ? "Passed" : unavailable ? "Unavailable" : "Failed",
        exitCode: code,
        outputDigest: sha256(output),
      });
    });
  });

const notRun = (
  commands: readonly RequiredCommand[],
): readonly CommandReceipt[] =>
  commands.map((command) => ({
    executable: command[0],
    arguments: command.slice(1),
    status: "NotRun",
    exitCode: null,
    outputDigest: null,
  }));

const toSarif = (findings: readonly Finding[]): SarifLog => ({
  version: "2.1.0",
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  runs: [
    {
      tool: {
        driver: {
          name: "STEAssay",
          version: TOOL_VERSION,
          rules: ruleCatalog.map((rule) => ({
            id: rule.id,
            shortDescription: { text: rule.title },
            defaultConfiguration: {
              level: rule.severity === "blocking" ? "error" : "warning",
            },
          })),
        },
      },
      results: findings.map((finding) => ({
        ruleId: finding.ruleId,
        level: finding.severity === "blocking" ? "error" : "warning",
        message: { text: finding.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: finding.path },
              region: {
                startLine: finding.position.line,
                startColumn: finding.position.column,
              },
            },
          },
        ],
      })),
    },
  ],
});

const receipt = (
  command: Receipt["command"],
  input: {
    readonly configuration?: LoadedConfiguration;
    readonly scope?: ScopeObservation;
    readonly contentDigest?: string | null;
    readonly findings?: readonly Finding[];
    readonly requiredCommands?: readonly CommandReceipt[];
    readonly verdict: VerdictKind;
    readonly authoritative: boolean;
    readonly limitations: readonly string[];
  },
): Receipt => {
  const findings = input.findings ?? [];
  return {
    schemaVersion: 2,
    command,
    generatedAt: clock(),
    tool: { name: "ste-assay", version: TOOL_VERSION },
    source: { contentDigest: input.contentDigest ?? null },
    configuration: {
      policyPath:
        input.configuration === undefined
          ? null
          : normalizePath(
              relative(
                input.configuration.root,
                input.configuration.policyPath,
              ),
            ),
      policyDigest: input.configuration?.policyDigest ?? null,
      glossaryPath:
        input.configuration === undefined
          ? null
          : normalizePath(
              relative(
                input.configuration.root,
                input.configuration.glossaryPath,
              ),
            ),
      glossaryDigest: input.configuration?.glossaryDigest ?? null,
      vocabularyPath:
        input.configuration === undefined
          ? null
          : normalizePath(
              relative(
                input.configuration.root,
                input.configuration.vocabularyPath,
              ),
            ),
      vocabularyDigest: input.configuration?.vocabularyDigest ?? null,
      profile: input.configuration?.policy.profile ?? null,
      ruleCatalogDigest: catalogDigest,
    },
    toolchain: { node: process.version, npm: npmVersion() },
    scope: input.scope ?? emptyScope(),
    findings,
    findingsDigest: sha256(canonicalJson(findings)),
    requiredCommands: input.requiredCommands ?? [],
    verdict: input.verdict,
    authoritative: input.authoritative,
    authorityLimitations: [...input.limitations].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
};

const baselineFindings = (
  findings: readonly Finding[],
  configuration: LoadedConfiguration,
): readonly Finding[] => {
  const baseline = new Set(
    configuration.policy.baseline.map((entry) => entry.fingerprint),
  );
  return findings.map((finding) => ({
    ...finding,
    baseline:
      configuration.policy.profile === "converge" &&
      baseline.has(finding.fingerprint),
  }));
};

const decide = (
  configuration: LoadedConfiguration,
  scope: ScopeObservation,
  findings: readonly Finding[],
  requiredCommands: readonly CommandReceipt[],
  command: Receipt["command"],
): {
  readonly verdict: VerdictKind;
  readonly authoritative: boolean;
  readonly limitations: readonly string[];
} => {
  const limitations: string[] = [];
  if (!scope.complete) {
    limitations.push(
      "Requested scope was incomplete: unmatched or unloaded Markdown paths exist.",
    );
  }
  if (
    command === "scan" &&
    requiredCommands.some((item) => item.status === "NotRun")
  ) {
    limitations.push("Configured required commands were not run by scan.");
  }
  if (command === "verify") {
    for (const item of requiredCommands) {
      if (item.status !== "Passed") {
        limitations.push(
          `Required command did not pass: ${displayCommand([item.executable, ...item.arguments])} (${item.status}).`,
        );
      }
    }
  }
  if (limitations.length > 0) {
    const unavailable = requiredCommands.some(
      (item) => item.status === "Unavailable",
    );
    return {
      verdict: unavailable ? "ToolFailure" : "Inconclusive",
      authoritative: false,
      limitations,
    };
  }
  const blocking = findings.filter(
    (finding) =>
      finding.severity === "blocking" &&
      !(configuration.policy.profile === "converge" && finding.baseline),
  );
  if (blocking.length > 0) {
    return {
      verdict: "Fail",
      authoritative: false,
      limitations: ["Blocking findings were observed in the configured scope."],
    };
  }
  return {
    verdict: "Pass",
    authoritative: true,
    limitations: [
      "Pass is limited to this pinned tool, policy, configured data, and successfully observed Markdown scope.",
    ],
  };
};

export const execute = async (
  command: Receipt["command"],
  target: string,
): Promise<AnalysisResult> => {
  let root: string;
  let fileTarget: string | undefined;
  try {
    ({ root, fileTarget } = await resolveTarget(target));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = receipt(command, {
      verdict: "ToolFailure",
      authoritative: false,
      limitations: [message],
    });
    return { receipt: failed, sarif: toSarif([]) };
  }
  let configuration: LoadedConfiguration;
  try {
    configuration = await loadConfiguration(root);
  } catch (error) {
    const message =
      error instanceof ConfigurationError
        ? error.message
        : `Configuration loading failed: ${String(error)}`;
    const failed = receipt(command, {
      verdict: "Inconclusive",
      authoritative: false,
      limitations: [message],
    });
    return { receipt: failed, sarif: toSarif([]) };
  }
  if (command === "doctor") {
    const result = receipt(command, {
      configuration,
      verdict: "Inconclusive",
      authoritative: false,
      limitations: [
        "Doctor checks toolchain and configuration readiness; it makes no compliance claim.",
      ],
    });
    return { receipt: result, sarif: toSarif([]) };
  }
  try {
    const observed = await observeScope(root, configuration.policy, fileTarget);
    const rawFindings = analyzeFiles(observed.files, {
      maxWords: configuration.policy.rules["STE-S01"].maxWords,
      glossary: configuration.glossary,
      vocabulary: configuration.vocabulary,
      requirementMarkers: configuration.policy.rules["STE-S09"].markers,
      requirementModals: configuration.policy.rules["STE-S09"].modals,
    });
    const findings = baselineFindings(rawFindings, configuration);
    const requiredCommands =
      command === "verify"
        ? await Promise.all(
            configuration.policy.requiredCommands.map((required) =>
              commandReceipt(required, root),
            ),
          )
        : notRun(configuration.policy.requiredCommands);
    const decision = decide(
      configuration,
      observed.scope,
      findings,
      requiredCommands,
      command,
    );
    const result = receipt(command, {
      configuration,
      scope: observed.scope,
      contentDigest: sourceDigest(observed.files),
      findings,
      requiredCommands,
      verdict: decision.verdict,
      authoritative: decision.authoritative,
      limitations: decision.limitations,
    });
    return { receipt: result, sarif: toSarif(findings) };
  } catch (error) {
    const message =
      error instanceof MarkdownParseError
        ? error.message
        : `Analysis tool failure: ${String(error)}`;
    const failed = receipt(command, {
      configuration,
      verdict:
        error instanceof MarkdownParseError ? "Inconclusive" : "ToolFailure",
      authoritative: false,
      limitations: [message],
    });
    return { receipt: failed, sarif: toSarif([]) };
  }
};

export const writeArtifacts = async (
  target: string,
  result: AnalysisResult,
): Promise<{ readonly receiptPath: string; readonly sarifPath: string }> => {
  let root: string;
  try {
    root = (await resolveTarget(target)).root;
  } catch {
    root = resolve(target, "..");
  }
  const output = resolve(root, ".ste-assay");
  await mkdir(output, { recursive: true });
  const receiptPath = resolve(output, "receipt.json");
  const sarifPath = resolve(output, "report.sarif");
  await writeFile(receiptPath, canonicalJson(result.receipt), "utf8");
  await writeFile(sarifPath, canonicalJson(result.sarif), "utf8");
  return {
    receiptPath: normalizePath(relative(root, receiptPath)),
    sarifPath: normalizePath(relative(root, sarifPath)),
  };
};
