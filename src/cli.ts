#!/usr/bin/env node
import { execute, writeArtifacts } from "./evidence.js";
import { canonicalJson } from "./canonical.js";
import { findRule } from "./catalog.js";

const usage = (): string =>
  [
    "Usage: ste-assay <doctor|scan|verify|explain> <path-or-rule-id>",
    "",
    "Markdown-only controlled technical writing policy verifier.",
    "Artifacts: <target>/.ste-assay/receipt.json and <target>/.ste-assay/report.sarif",
  ].join("\n");

const main = async (): Promise<number> => {
  const [command, target] = process.argv.slice(2);
  if (command === "explain") {
    if (target === undefined) {
      process.stderr.write(`${usage()}\n`);
      return 64;
    }
    const rule = findRule(target);
    if (rule === undefined) {
      process.stderr.write(`Unknown rule: ${target}\n`);
      return 64;
    }
    process.stdout.write(canonicalJson(rule));
    return 0;
  }
  if (
    (command !== "doctor" && command !== "scan" && command !== "verify") ||
    target === undefined
  ) {
    process.stderr.write(`${usage()}\n`);
    return 64;
  }
  const result = await execute(command, target);
  let artifacts:
    | { readonly receiptPath: string; readonly sarifPath: string }
    | undefined;
  try {
    artifacts = await writeArtifacts(target, result);
  } catch (error) {
    process.stderr.write(
      `artifact=unavailable (${error instanceof Error ? error.message : String(error)})\n`,
    );
  }
  const findingText =
    result.receipt.findings.length === 1 ? "finding" : "findings";
  process.stdout.write(
    [
      `${result.receipt.verdict} authoritative=${String(result.receipt.authoritative)}`,
      `${result.receipt.findings.length} ${findingText}; scanned=${result.receipt.scope.scannedPaths.length}; excluded=${result.receipt.scope.excludedPaths.length}`,
      `receipt=${artifacts?.receiptPath ?? "unavailable"}`,
      `sarif=${artifacts?.sarifPath ?? "unavailable"}`,
      ...result.receipt.authorityLimitations.map(
        (item) => `limitation=${item}`,
      ),
    ].join("\n") + "\n",
  );
  if (command === "doctor" || result.receipt.verdict === "Pass") return 0;
  return result.receipt.verdict === "Fail" ? 1 : 2;
};

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `ToolFailure: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 70;
  });
