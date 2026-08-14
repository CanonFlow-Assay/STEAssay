import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { analyzeFiles } from "../src/analyzer.js";
import { wholeTerm } from "../src/core/analyzer.js";
import {
  applySafeCorrections,
  matchesExpectedPreview,
  previewMarkdown,
} from "../playground/preview.js";
import {
  bundledExamples,
  compliantSample,
  DEMONSTRATION_SOURCE_NOTE,
  getBundledExample,
  matchingPolicy,
  offenderSample,
  policyForExample,
} from "../playground/samples.js";

test("every bundled demonstration specimen has its documented preview result", () => {
  assert.equal(bundledExamples.length, 8);
  for (const example of bundledExamples) {
    const result = previewMarkdown(example.markdown, policyForExample(example));
    assert.deepEqual(
      result.findings
        .map((finding) => finding.ruleId)
        .sort((left, right) => left.localeCompare(right)),
      [...example.expected.ruleIds].sort((left, right) =>
        left.localeCompare(right),
      ),
      example.title,
    );
    assert.equal(result.blockingCount, example.expected.blockingCount);
    assert.equal(result.advisoryCount, example.expected.advisoryCount);
    assert.equal(matchesExpectedPreview(result, example.expected), true);
    assert.equal(example.sourceNote, DEMONSTRATION_SOURCE_NOTE);
    assert.equal(typeof example.glossary.abbreviations, "object");
    assert.equal(Array.isArray(example.vocabulary.bannedTerms), true);
  }
});

test("sentence-length comparison uses identical Markdown with explicit policy limits", () => {
  const twelveWord = getBundledExample("sentence-length-12");
  const twentyFiveWord = getBundledExample("sentence-length-25");
  assert.notEqual(twelveWord, undefined);
  assert.notEqual(twentyFiveWord, undefined);
  assert.equal(twelveWord?.markdown, twentyFiveWord?.markdown);
  assert.equal(twelveWord?.policy.maxWords, 12);
  assert.equal(twentyFiveWord?.policy.maxWords, 25);
  assert.deepEqual(twelveWord?.expected.ruleIds, ["STE-S01"]);
  assert.deepEqual(twentyFiveWord?.expected.ruleIds, []);
  assert.match(
    twelveWord?.limitation ?? "",
    /Abbreviations, URLs, versions, and decimals/u,
  );
});

test("expected preview comparison rejects a result with different observed findings", () => {
  const installation = getBundledExample("installation-guide");
  assert.notEqual(installation, undefined);
  const result = previewMarkdown(
    installation?.markdown ?? "",
    installation === undefined
      ? matchingPolicy()
      : policyForExample(installation),
  );
  assert.equal(
    matchesExpectedPreview(result, {
      ruleIds: ["STE-S04"],
      blockingCount: 1,
      advisoryCount: 0,
    }),
    false,
  );
});

test("browser preview reports no findings for the compliant sample", () => {
  const result = previewMarkdown(compliantSample, matchingPolicy());
  assert.equal(result.findings.length, 0);
  assert.equal(result.blockingCount, 0);
  assert.equal(result.advisoryCount, 0);
});

test("browser preview and Node analyzer agree on the offender sample", () => {
  const policy = matchingPolicy();
  const preview = previewMarkdown(offenderSample, policy);
  const nodeFindings = analyzeFiles(
    [
      {
        absolutePath: "/playground/playground.md",
        relativePath: "playground.md",
        content: offenderSample,
      },
    ],
    policy,
  );
  const expectedRuleIds = [
    "STE-S02",
    "STE-S01",
    "STE-S04",
    "STE-S08",
    "STE-S10",
    "STE-S06",
    "STE-S09",
    "STE-S05",
  ].sort();
  assert.deepEqual(
    preview.findings.map((finding) => finding.ruleId).sort(),
    expectedRuleIds,
  );
  assert.deepEqual(
    preview.findings.map((finding) => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      message: finding.message,
      path: finding.path,
      position: finding.position,
    })),
    nodeFindings.map((finding) => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      message: finding.message,
      path: finding.path,
      position: finding.position,
    })),
  );
});

test("browser preview retains Unicode whole-term boundaries", () => {
  const matching = matchingPolicy();
  const policy = {
    ...matching,
    vocabulary: { ...matching.vocabulary, bannedTerms: ["cat"] },
  };
  const result = previewMarkdown(
    "scat catapult cat écat caté котcat catёж cat2 2cat cat_value _cat",
    policy,
  );
  assert.equal(
    wholeTerm("cat").source,
    "(?<![\\p{L}\\p{N}_])cat(?![\\p{L}\\p{N}_])",
  );
  assert.deepEqual(
    result.findings.filter((finding) => finding.ruleId === "STE-S04"),
    [
      {
        ruleId: "STE-S04",
        severity: "blocking",
        message: "Configured banned term occurs: cat.",
        path: "playground.md",
        position: { line: 1, column: 15 },
        excerpt:
          "scat catapult cat écat caté котcat catёж cat2 2cat cat_value _cat",
        correction: undefined,
        manualInstruction:
          "Remove or replace this configured banned term manually; no replacement is guessed.",
      },
    ],
  );
});

test("safe corrections replace only configured deprecated and terminology terms", () => {
  const policy = matchingPolicy();
  const corrected = applySafeCorrections(offenderSample, policy);
  assert.match(corrected, /allow list/u);
  assert.match(corrected, /service/u);
  assert.match(corrected, /robust/u);
  assert.match(corrected, /Open and run/u);
  assert.doesNotMatch(corrected, /whitelist/u);
  assert.doesNotMatch(corrected, /daemon/u);
  const result = previewMarkdown(offenderSample, policy);
  assert.deepEqual(
    result.findings
      .flatMap((finding) =>
        finding.correction === undefined ? [] : [finding.correction],
      )
      .sort((left, right) => left.from.localeCompare(right.from)),
    [
      { ruleId: "STE-S10", from: "daemon", to: "service" },
      { ruleId: "STE-S08", from: "whitelist", to: "allow list" },
    ],
  );
});

test("browser preview is deterministic and has no command-execution runtime path", async () => {
  const policy = matchingPolicy();
  const first = previewMarkdown(offenderSample, policy);
  const second = previewMarkdown(offenderSample, policy);
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  const browserArtifacts = [
    "dist/playground/app.js",
    "dist/playground/preview.js",
    "dist/playground/samples.js",
    "dist/playground/core/analyzer.js",
    "dist/playground/rules.js",
  ];
  const forbidden =
    /node:|child_process|spawn\(|shell\b|process\.|requiredCommands|fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/u;
  for (const artifact of browserArtifacts) {
    const source = await readFile(resolve(process.cwd(), artifact), "utf8");
    assert.doesNotMatch(source, forbidden, artifact);
  }
});

test("static playground entrypoint smoke test includes the local-only boundary", async () => {
  const document = await readFile(
    resolve(process.cwd(), "dist", "playground", "index.html"),
    "utf8",
  );
  assert.match(document, /Preview only — non-authoritative/u);
  assert.match(
    document,
    /This page never\s+uploads text or executes project commands\./u,
  );
  assert.match(document, /<script type="module" src="\.\/app\.js"><\/script>/u);
});

test("parser preserves ATX and setext headings across immutable collection updates", () => {
  const result = previewMarkdown(
    "#\n\nInstallation\n---\n\nUse the API.",
    matchingPolicy(),
  );
  assert.deepEqual(
    result.findings.map((finding) => ({
      ruleId: finding.ruleId,
      position: {
        line: finding.position.line,
        column: finding.position.column,
      },
    })),
    [{ ruleId: "STE-S02", position: { line: 1, column: 2 } }],
  );
});
