import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { execute } from "../src/evidence.js";

const fixtureRoot = resolve(process.cwd(), "tests", "fixtures");

const makeProject = async (fixture = "good"): Promise<string> => {
  const directory = await mkdtemp(resolve(tmpdir(), "ste-assay-test-"));
  await cp(resolve(fixtureRoot, fixture), directory, { recursive: true });
  return directory;
};

const cleanup = async (directory: string): Promise<void> => {
  await rm(directory, { recursive: true, force: true });
};

const policy = async (directory: string): Promise<Record<string, unknown>> =>
  JSON.parse(
    await readFile(resolve(directory, ".steassay.json"), "utf8"),
  ) as Record<string, unknown>;

const writePolicy = async (
  directory: string,
  value: Record<string, unknown>,
): Promise<void> => {
  await writeFile(
    resolve(directory, ".steassay.json"),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
};

test("verify reports authoritative Pass for complete compliant scope and passed evidence", async () => {
  const directory = await makeProject();
  try {
    const result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Pass");
    assert.equal(result.receipt.authoritative, true);
    assert.deepEqual(result.receipt.scope.scannedPaths, ["docs/guide.md"]);
    assert.deepEqual(result.receipt.scope.excludedPaths, [
      "docs/excluded/private.md",
    ]);
    assert.equal(result.receipt.requiredCommands[0]?.status, "Passed");
  } finally {
    await cleanup(directory);
  }
});

test("scan represents required commands as NotRun and cannot be authoritative", async () => {
  const directory = await makeProject();
  try {
    const result = await execute("scan", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
    assert.equal(result.receipt.requiredCommands[0]?.status, "NotRun");
  } finally {
    await cleanup(directory);
  }
});

test("doctor makes no compliance claim", async () => {
  const directory = await makeProject();
  try {
    const result = await execute("doctor", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
    assert.equal(result.receipt.findings.length, 0);
  } finally {
    await cleanup(directory);
  }
});

for (const [rule, expectedSeverity] of [
  ["STE-S01", "blocking"],
  ["STE-S02", "blocking"],
  ["STE-S03", "blocking"],
  ["STE-S04", "blocking"],
  ["STE-S05", "advisory"],
  ["STE-S06", "advisory"],
  ["STE-S08", "blocking"],
  ["STE-S09", "advisory"],
  ["STE-S10", "advisory"],
] as const) {
  test(`${rule} fixture is detected with its admitted severity`, async () => {
    const directory = await makeProject();
    try {
      await cp(
        resolve(fixtureRoot, "rules", rule, "bad.md"),
        resolve(directory, "docs", `${rule}.md`),
      );
      const result = await execute("verify", directory);
      const finding = result.receipt.findings.find(
        (item) => item.ruleId === rule,
      );
      assert.equal(finding?.severity, expectedSeverity);
      if (expectedSeverity === "blocking") {
        assert.equal(result.receipt.verdict, "Fail");
      }
    } finally {
      await cleanup(directory);
    }
  });

  test(`${rule} good fixture does not trigger ${rule}`, async () => {
    const directory = await makeProject();
    try {
      await cp(
        resolve(fixtureRoot, "rules", rule, "good.md"),
        resolve(directory, "docs", `${rule}.md`),
      );
      const result = await execute("verify", directory);
      assert.equal(
        result.receipt.findings.some((item) => item.ruleId === rule),
        false,
      );
    } finally {
      await cleanup(directory);
    }
  });
}

test("invalid policy cannot pass", async () => {
  const directory = await makeProject();
  try {
    await writeFile(resolve(directory, ".steassay.json"), "{ invalid", "utf8");
    const result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
  } finally {
    await cleanup(directory);
  }
});

test("missing glossary and unreadable vocabulary cannot pass", async () => {
  const directory = await makeProject();
  try {
    const configured = await policy(directory);
    configured.glossaryPath = "absent.json";
    await writePolicy(directory, configured);
    let result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    configured.glossaryPath = "glossary.json";
    configured.vocabularyPath = "missing-vocabulary.json";
    await writePolicy(directory, configured);
    result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
  } finally {
    await cleanup(directory);
  }
});

test("malformed Markdown remains non-authoritative", async () => {
  const directory = await makeProject();
  try {
    await writeFile(
      resolve(directory, "docs", "broken.md"),
      "# Broken\n\n```text\nunclosed\n",
      "utf8",
    );
    const result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
  } finally {
    await cleanup(directory);
  }
});

test("incomplete scope and unavailable required command cannot pass", async () => {
  const directory = await makeProject();
  try {
    const configured = await policy(directory);
    configured.includeGlobs = ["docs/**/*.md", "missing/**/*.md"];
    await writePolicy(directory, configured);
    let result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    configured.includeGlobs = ["docs/**/*.md"];
    configured.requiredCommands = ["surely-unavailable-ste-assay-command"];
    await writePolicy(directory, configured);
    result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "ToolFailure");
    assert.equal(result.receipt.authoritative, false);
  } finally {
    await cleanup(directory);
  }
});

test("a configured non-Markdown path makes Markdown scope incomplete", async () => {
  const directory = await makeProject();
  try {
    await writeFile(
      resolve(directory, "docs", "note.txt"),
      "plain text",
      "utf8",
    );
    const configured = await policy(directory);
    configured.includeGlobs = ["docs/**/*"];
    await writePolicy(directory, configured);
    const result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
    assert.deepEqual(result.receipt.scope.unloadedPaths, ["docs/note.txt"]);
  } finally {
    await cleanup(directory);
  }
});

test("missing target cannot pass", async () => {
  const result = await execute(
    "verify",
    resolve(tmpdir(), "ste-assay-target-does-not-exist"),
  );
  assert.equal(result.receipt.verdict, "ToolFailure");
  assert.equal(result.receipt.authoritative, false);
});

test("converge preserves baseline debt and blocks a new blocking finding", async () => {
  const directory = await makeProject();
  try {
    await writeFile(
      resolve(directory, "docs", "legacy.md"),
      "# Legacy\n\nforbiddenword\n",
      "utf8",
    );
    const initial = await execute("verify", directory);
    const legacy = initial.receipt.findings.find(
      (finding) =>
        finding.ruleId === "STE-S04" && finding.path === "docs/legacy.md",
    );
    assert.ok(legacy);
    const configured = await policy(directory);
    configured.profile = "converge";
    configured.baseline = [
      {
        fingerprint: legacy.fingerprint,
        rationale: "Observed legacy project term.",
        reviewedBy: "test",
      },
    ];
    await writePolicy(directory, configured);
    let result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Pass");
    assert.equal(
      result.receipt.findings.find(
        (finding) => finding.fingerprint === legacy.fingerprint,
      )?.baseline,
      true,
    );
    await writeFile(
      resolve(directory, "docs", "new.md"),
      "# New\n\nforbiddenword\n",
      "utf8",
    );
    result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Fail");
    assert.equal(
      result.receipt.findings.filter((finding) => finding.ruleId === "STE-S04")
        .length,
      2,
    );
  } finally {
    await cleanup(directory);
  }
});

test("receipt and SARIF are deterministic with a controlled clock", async () => {
  const directory = await makeProject();
  const previous = process.env.STE_ASSAY_CLOCK;
  process.env.STE_ASSAY_CLOCK = "2026-08-13T00:00:00.000Z";
  try {
    await writeFile(
      resolve(directory, "docs", "b.md"),
      "# B\n\nforbiddenword\n",
      "utf8",
    );
    await writeFile(
      resolve(directory, "docs", "a.md"),
      "# A\n\noldword\n",
      "utf8",
    );
    const first = await execute("scan", directory);
    const second = await execute("scan", directory);
    assert.equal(JSON.stringify(first.receipt), JSON.stringify(second.receipt));
    assert.equal(JSON.stringify(first.sarif), JSON.stringify(second.sarif));
    assert.deepEqual(
      first.receipt.findings.map((finding) => finding.path),
      ["docs/a.md", "docs/b.md"],
    );
  } finally {
    if (previous === undefined) delete process.env.STE_ASSAY_CLOCK;
    else process.env.STE_ASSAY_CLOCK = previous;
    await cleanup(directory);
  }
});
