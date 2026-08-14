# TypeScriptAssay M1 evidence

This directory is the evidence-only M1 snapshot for the first-party TypeScript
scope of [STEAssay](https://github.com/CanonFlow-Assay/STEAssay) at
`e4f914cfa25ea1fbcea79dc6146312cef906fda0`.

The observed result is `Pass` with `authoritative: true`. That means only that
the recorded TypeScriptAssay toolchain, policy, selected scope, and required
commands observed no _new_ blocking finding. It is not approval of the
baselined findings, a claim about Markdown, or a claim about all repository
files.

## Contents

- `policy.json` is the exact converge policy. Its 29 reviewed entries are the
  blocking fingerprints first observed in the unmodified source; they remain
  visible as `baseline: true` in `receipt.json`.
- `receipt.json` and `report.sarif` are the canonical TypeScriptAssay outputs.
- `rule-catalog.json`, `scope-manifest.json`, and `toolchain-manifest.json`
  bind the admitted rules, exact selected/excluded/unloaded scope, project
  configuration provenance, package, integrity, runtime, and lockfile data.
- `adversarial-results.json` records the non-authoritative invalid-policy,
  missing-target, missing-selected-source, unrun-command, incomplete-scope,
  source-drift, and unavailable-command exercises.

Verify the stored evidence bytes with:

```sh
cd docs/evidence/m1-typescriptassay
sha256sum -c SHA256SUMS
```

## Scope and baseline

The policy selects only `src/**/*.ts`, `playground/**/*.ts`, and
`tests/**/*.ts`; the functional-domain observation is limited to
`src/core/**/*.ts`. It excludes dependencies, generated/built JavaScript,
assay output, tarballs, and non-TypeScript test fixtures. See
`scope-manifest.json` for exact observed lists, unmatched globs, and project
configuration digests.

The initial `new` scan observed 45 findings: 29 errors and 16 warnings. The
29 errors are retained as reviewed converge entries with the rationale that
they were observed in unmodified source during this exercise. The 16
`TSA-B03` warnings remain visible through explicit `allow-with-receipt`
escape-hatch policy; they were not deleted or hidden.

## Limits and replay boundary

`typescript-assay@0.1.1` has registry integrity
`sha512-iu2ecPYRDI+gXWy67nfoUyaxZKdtRG49clmdiVnWYw/0ylmxrQ7CXva6nwcYsxoSdohB0n2gi5pkLIUQGD+0dg==`.
Its receipt currently self-reports CLI `0.1.0`; both values are deliberately
recorded in `toolchain-manifest.json` rather than reconciled here.

The policy's required commands are repository-controlled trusted input. The
published TypeScriptAssay CLI launches them through a shell, so changes to
`policy.json` require CI-workflow-level review. The evidence replay workflow
has read-only permissions, no secrets, and skips fork pull requests.

The files listed in `.prettierignore` are the exact canonical or tool-produced
payloads covered by `SHA256SUMS`; excluding them prevents a formatter from
changing recorded bytes. `SHA256SUMS` verifies this snapshot. A fresh verify
can legitimately have different command-output digests when a test runner
prints variable timing, even with a controlled receipt clock.
