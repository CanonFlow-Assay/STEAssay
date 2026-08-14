# M2 — TypeScriptAssay baseline triage

M2 classifies the 29 blocking baselines and 16 TSA-B03 warnings from the
[M1 receipt](m1-typescriptassay.md). It fixes only three local, mechanical
parser collection mutations. No rule, rule severity, policy scope, browser
behavior, package metadata, or CLI behavior changes in this slice.

The repository has no `CODEOWNERS` file. For retained findings, the recorded
review owner is **CanonFlow-Assay/STEAssay maintainers**.

## Baseline ledger

| Rule    | Files                                                                                                                                                    |       Count | Cause                                                                                                            | Action                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------: | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| TSA-B03 | `playground/app.ts` (3), `playground/samples.ts` (1), `src/canonical.ts` (1), `src/core/analyzer.ts` (1), `src/policy.ts` (6), `tests/assay.test.ts` (4) | 16 warnings | Explicit assertions narrow DOM, JSON, regex, serializer, and test-harness values.                                | Retain as visible escape-hatch evidence; owner: maintainers.                           |
| TSA-B01 | `playground/preview.ts` (2), `src/analyzer.ts` (1), `src/core/analyzer.ts` (1)                                                                           |           4 | Shared analyzer and browser adapter accept already-typed internal values across their current public boundaries. | Investigate; decoding changes could alter API and browser/CLI parity.                  |
| TSA-D01 | `src/core/analyzer.ts` (3)                                                                                                                               |           3 | Parse-safety and catalogue-invariant exceptions become explicit CLI `ToolFailure` evidence.                      | Retain; owner: maintainers. Changing this changes public failure flow.                 |
| TSA-D03 | `src/core/analyzer.ts` (2)                                                                                                                               |           2 | Regex capture and line indexing rely on guarded parser invariants not recognized by the rule.                    | Investigate; a refinement changes parser control flow.                                 |
| TSA-E02 | `src/core/analyzer.ts` (2)                                                                                                                               |           2 | Shared core imports the rule catalogue and model from files classified as boundary scope by the M1 policy.       | Retain; owner: maintainers. Do not reclassify scope merely to hide the dependency.     |
| TSA-I02 | `src/core/analyzer.ts` (119, 147, 163)                                                                                                                   |           3 | Local parser collection appends had direct immutable equivalents.                                                | Fix now: replaced `push` with `concat`; no behavior change.                            |
| TSA-I02 | `src/core/analyzer.ts` (7, 160, 184, 231, 248, 262, 272, 287, 303, 316, 328, 344, 357, 370)                                                              |          15 | Error naming, parser state, finding accumulation, and final ordering still use mutation.                         | Investigate; a broader rewrite could affect parse order, locations, or browser parity. |

## Groups

### Fix now

- TSA-I02 at `src/core/analyzer.ts:119`, `:147`, and `:163`.
- The change is mechanical: `concat` returns the same ordered collections that
  `push` produced. It introduces no rule or behavior change.
- A characterization test covers ATX and setext heading handling through these
  collection updates.

### Retain

- TSA-B03 remains visible under `allow-with-receipt`; it is evidence rather
  than a passing exemption.
- TSA-D01 records deliberate parse/invariant failures that the CLI surfaces as
  non-authoritative tool evidence.
- TSA-E02 records the present shared-core import shape. The policy is not
  broadened or relabeled to make this observation disappear.

Each retained group is owned for review by CanonFlow-Assay/STEAssay maintainers
until the repository records a narrower code-owner assignment.

### Investigate

- TSA-B01 needs a deliberate internal/boundary API decision.
- TSA-D03 needs parser-invariant refinements whose location behavior must be
  characterized first.
- The remaining 15 TSA-I02 findings require a larger parser/data-flow rewrite
  and browser-parity review.

M2 makes no code change for these groups.

## Second receipt and delta

The M2 receipt records `Pass` and `authoritative: true`. All configured format,
lint, typecheck, unit-test, build, and Playwright commands passed. The baseline
delta is:

| Measure                           |  M1 |  M2 |
| --------------------------------- | --: | --: |
| Visible findings                  |  45 |  42 |
| Blocking baselines                |  29 |  26 |
| TSA-B03 warnings                  |  16 |  16 |
| New unbaselined blocking findings |   — |   0 |

The [evidence bundle](evidence/m2-typescriptassay-baseline-triage/) contains
the receipt, SARIF, exact policy, rule catalogue, scope/toolchain manifests,
and [baseline delta](evidence/m2-typescriptassay-baseline-triage/baseline-delta.json).

## M3 decision — CLI trust boundary

**Choose B for a future dedicated M3 design PR:** replace shell command strings
with an explicit executable-and-argument array. The current string policy is a
trusted executable-policy boundary and can express compound shell operations;
an argument array is the clearer long-term evidence model.

M2 does **not** change that boundary. Until M3, option A applies operationally:
review policy changes like CI workflow code, do not execute fork-controlled
policy with secrets, and keep the replay workflow read-only and fork-skipping.
The separate M3 design PR must specify the schema, no-shell launcher,
compatibility/migration behavior, receipt format, adversarial tests, and release
impact before implementation.
