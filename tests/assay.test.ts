import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { analyzeFiles } from "../src/analyzer.js";
import { sha256 } from "../src/canonical.js";
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

const analysisConfiguration = (
  overrides: Partial<{
    readonly maxWords: number;
    readonly bannedTerms: readonly string[];
  }> = {},
) => ({
  maxWords: overrides.maxWords ?? 12,
  glossary: { abbreviations: {} },
  vocabulary: {
    bannedTerms: overrides.bannedTerms ?? [],
    deprecatedTerms: [],
    imperativeVerbs: [],
    terminology: [],
  },
  requirementMarkers: [],
  requirementModals: [],
});

const loadCompiledWholeTerm = async (): Promise<(term: string) => RegExp> => {
  const artifactPath = resolve(
    process.cwd(),
    "dist",
    "src",
    "core",
    "analyzer.js",
  );
  let artifact = await readFile(artifactPath, "utf8");
  const replacements: readonly [string, string][] = [
    [
      'import { findRule } from "../rules.js";',
      "const findRule = () => undefined;",
    ],
  ];
  for (const [source, replacement] of replacements) {
    assert.equal(artifact.includes(source), true);
    artifact = artifact.replace(source, replacement);
  }
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(
    `${artifact}\nexport { wholeTerm as inspectedWholeTerm };\n`,
  ).toString("base64")}`;
  const inspected = (await import(moduleUrl)) as {
    readonly inspectedWholeTerm: (term: string) => RegExp;
  };
  return inspected.inspectedWholeTerm;
};

test("CLI help exits successfully without requiring a target", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(process.cwd(), "dist", "src", "cli.js"), "--help"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ste-assay/u);
});

test("whole configured terms use the runtime Unicode letter-number-underscore boundary", async () => {
  const wholeTerm = await loadCompiledWholeTerm();
  const pattern = wholeTerm("cat");
  assert.equal(pattern.source, "(?<![\\p{L}\\p{N}_])cat(?![\\p{L}\\p{N}_])");
  assert.equal(pattern.flags, "giu");
  const matches = (text: string): boolean => wholeTerm("cat").test(text);
  assert.equal(matches("scat"), false);
  assert.equal(matches("catapult"), false);
  assert.equal(matches("cat"), true);
  assert.equal(matches("écat"), false);
  assert.equal(matches("caté"), false);
  assert.equal(matches("котcat"), false);
  assert.equal(matches("catёж"), false);
  assert.equal(matches("2cat"), false);
  assert.equal(matches("cat2"), false);
  assert.equal(matches("_cat"), false);
  assert.equal(matches("cat_value"), false);

  const findings = analyzeFiles(
    [
      {
        absolutePath: "/observed/docs/terms.md",
        relativePath: "docs/terms.md",
        content:
          "scat catapult cat écat caté котcat catёж 2cat cat2 _cat cat_value",
      },
    ],
    analysisConfiguration({ bannedTerms: ["cat"] }),
  ).filter((finding) => finding.ruleId === "STE-S04");
  assert.deepEqual(
    findings.map((finding) => finding.message),
    ["Configured banned term occurs: cat."],
  );
});

test("STE-S01 sentence splitting has characterized false negatives for period-bearing tokens", () => {
  const cases = [
    ["U.S.", "U.S. contains alpha beta gamma."],
    ["e.g.", "e.g. contains alpha beta gamma."],
    ["version 1.2.3", "Version 1.2.3 has alpha beta gamma."],
    ["example.com", "example.com has alpha beta gamma."],
    ["decimal 3.14", "Value 3.14 has alpha beta gamma."],
  ] as const;
  for (const [label, content] of cases) {
    const findings = analyzeFiles(
      [
        {
          absolutePath: "/observed/docs/sentence.md",
          relativePath: "docs/sentence.md",
          content,
        },
      ],
      analysisConfiguration({ maxWords: 5 }),
    ).filter((finding) => finding.ruleId === "STE-S01");
    assert.deepEqual(
      findings,
      [],
      `${label} is split at periods before the full prose sentence exceeds the configured limit.`,
    );
  }
});

test("required commands preserve literal argv and do not interpolate shell syntax", async () => {
  const directory = await makeProject();
  try {
    const configured = await policy(directory);
    const marker = resolve(directory, "shell-interpolation-marker.txt");
    const injected = `literal && ${JSON.stringify(process.execPath)} -e ${JSON.stringify("require('node:fs').writeFileSync(process.argv[1], 'executed')")} ${JSON.stringify(marker)}`;
    const command = [process.execPath, "-p", "process.argv[1]", injected];
    configured.requiredCommands = [command];
    await writePolicy(directory, configured);

    const result = await execute("verify", directory);
    const receipt = result.receipt.requiredCommands[0];
    assert.equal(result.receipt.verdict, "Pass");
    assert.equal(result.receipt.schemaVersion, 2);
    assert.equal(receipt?.executable, process.execPath);
    assert.deepEqual(receipt?.arguments, command.slice(1));
    assert.equal(receipt?.status, "Passed");
    assert.equal(receipt?.exitCode, 0);
    assert.equal(receipt?.outputDigest, sha256(`${injected}\n`));
    await assert.rejects(readFile(marker, "utf8"));
  } finally {
    await cleanup(directory);
  }
});

test("legacy v1 shell-policy fixture is rejected before a child process starts", async () => {
  const directory = await makeProject("legacy-shell-policy");
  try {
    const marker = resolve(directory, "legacy-shell-marker.txt");
    const result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
    assert.match(
      result.receipt.authorityLimitations[0] ?? "",
      /legacy shell command strings and is not executed/u,
    );
    await assert.rejects(readFile(marker, "utf8"));
  } finally {
    await cleanup(directory);
  }
});

test("malformed command arrays cannot pass", async () => {
  const directory = await makeProject();
  try {
    const configured = await policy(directory);
    configured.requiredCommands = ["node --version"];
    await writePolicy(directory, configured);
    let result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
    assert.match(
      result.receipt.authorityLimitations[0] ?? "",
      /must be a non-empty array of non-empty strings/u,
    );

    configured.requiredCommands = [[]];
    await writePolicy(directory, configured);
    result = await execute("verify", directory);
    assert.equal(result.receipt.verdict, "Inconclusive");
    assert.equal(result.receipt.authoritative, false);
  } finally {
    await cleanup(directory);
  }
});

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
    assert.equal(result.receipt.configuration.policyPath, ".steassay.json");
    assert.equal(result.receipt.configuration.glossaryPath, "glossary.json");
    assert.equal(
      result.receipt.configuration.vocabularyPath,
      "vocabulary.json",
    );
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
    assert.equal(result.receipt.requiredCommands[0]?.executable, "node");
    assert.deepEqual(result.receipt.requiredCommands[0]?.arguments, [
      "--version",
    ]);
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
    configured.requiredCommands = [["surely-unavailable-ste-assay-command"]];
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
