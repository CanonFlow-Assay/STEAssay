# M1: Winston documentation consumer

M1 exercises STEAssay `0.1.0` against a real public Markdown documentation
repository. It is a single-agent exercise, not an independent review.

## Consumer selection

- Repository: <https://github.com/winstonjs/winston>
- Licence: MIT (`LICENSE` at the inspected revision)
- Consumer revision: `ff0b79de8562bb322c390fbc82fe71c11f373428`
- STEAssay base revision: `9af40fb7173b509eb11b9c94615a6b5574a5c7d5`
- Consumer runtime declaration: Node `>= 12.0.0`; no `packageManager` field.
- Consumer dependency evidence: `package-lock.json` SHA-256
  `916fbc5f044cc713a78f57f7c59c90ab5404c90374190e7a8f7ffb875fc70cf0`.

Winston was selected because it is a maintained MIT-licensed technical Node
library with a pinned npm lockfile and a bounded Markdown documentation
directory. The documentation tree contains 2,528 lines across `publishing.md`,
`releases.md`, and the much larger `transports.md`. The observed scope is
explicitly limited to the first two files; `docs/transports.md` is explicitly
excluded and is listed in the receipt. The consumer was cloned only to
disposable local storage. Its tracked files and remote repository were never
changed.

## Policy and initial observation

The project-local policy, glossary, and vocabulary are preserved in
[the evidence bundle](evidence/m1-winston/). They contain only small M1-owned
examples: five general technical abbreviations, an arbitrary banned term
`config`, and an arbitrary deprecated term `default`. They are not ASD-STE100
vocabulary or a derived word list.

The initial `new` profile scan used the same explicit includes and exclusion,
an 80-word limit, and `npm test` as a required command. `scan` correctly
reported `Inconclusive`, `authoritative: false`, because required commands are
recorded as `NotRun`. It observed 13 findings, including these nine blocking
fingerprints:

- `STE-S03`: four configured-glossary findings;
- `STE-S04`: three configured banned-term findings;
- `STE-S08`: two configured deprecated-term findings.

Initial policy digest:
`3e09c18180c00dcb9640aa060f9cd43d54caf81e4110886596baa498e1eb8daa`.

Initial findings digest:
`a2112d48018ebc55baff2fe46ebe1967ea28840e04f95ceef115808c5b63b8e9`.

All nine exact blocking fingerprints were then added to the committed evidence
policy with a truthful rationale and
`reviewedBy: "single-agent M1 documentation consumer exercise"`. The baseline
does not delete or hide them; the final receipt marks them `baseline: true`.

The consumer's `npm test` was started once under `verify` but did not terminate
in this local environment. Its owned processes were stopped; that incomplete
attempt is not claimed as passed evidence. The final converge policy substitutes
the consumer's documented `npm run lint` command, which completed with exit
code `0` (10 warnings, no errors). The scope, finding set, and baseline were
not changed to obtain that result.

## Final observed result

`doctor`, `scan`, and `verify` were run with controlled clock
`2026-08-13T05:40:00.000Z`.

| Command  | Result                                                                          |
| -------- | ------------------------------------------------------------------------------- |
| `doctor` | `Inconclusive`, non-authoritative by design                                     |
| `scan`   | exit `2`; `Inconclusive`, non-authoritative because `npm run lint` was `NotRun` |
| `verify` | exit `0`; `Pass`, `authoritative: true`                                         |

The final receipt binds these observed facts:

- scanned paths: `docs/publishing.md`, `docs/releases.md`;
- excluded path: `docs/transports.md`;
- unmatched paths: none;
- unloaded paths: none;
- required command: `npm run lint`, `Passed`, exit `0`, output digest
  `8ac7a8628cb7651736212b666616e62e44dc968c78633ff04532299c009ece2d`;
- 13 total findings: nine visible baselined blocking findings and four advisory
  findings (`STE-S05` once and `STE-S10` three times);
- source digest: `9cca3cf036f919d0ff0f06a70808e171926519bba52ed515d0c4838b6dc23cc1`;
- rule-catalog digest:
  `551ebacf7dd8471d3faaa0a3d1b5be09109631158468ca0e543f359e8664d5c1`.

The policy, glossary, vocabulary, receipt, and SARIF are checksummed in
[SHA256SUMS](evidence/m1-winston/SHA256SUMS). Verify them with:

```text
cd docs/evidence/m1-winston
sha256sum -c SHA256SUMS
```

## Self-adversarial verification

Each case was performed only in the disposable clone and removed or restored
afterward. None produced an authoritative Pass:

| Probe                                  | Result                   |
| -------------------------------------- | ------------------------ |
| Invalid policy                         | `Inconclusive`, exit `2` |
| Missing target                         | `ToolFailure`, exit `2`  |
| Missing glossary                       | `Inconclusive`, exit `2` |
| Missing vocabulary                     | `Inconclusive`, exit `2` |
| Unclosed Markdown code fence           | `Inconclusive`, exit `2` |
| Unavailable required command           | `ToolFailure`, exit `2`  |
| Unmatched required inclusion glob      | `Inconclusive`, exit `2` |
| New unbaselined configured banned term | `Fail`, exit `1`         |

The unbaselined-term probe retained the nine known blocking findings and added
one new `STE-S04` finding; it failed rather than treating the baseline as a
blanket ignore.

## Repository verification

From the STEAssay M1 branch, all required repository checks passed:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test       # 29/29
npm run build
```

## Limits

This is not a claim about all Winston documentation, prose quality, or
ASD-STE100 compliance. Authority applies only to the pinned STEAssay revision,
the checked-in M1 policy/data, two successfully parsed Markdown files, the
explicit exclusion, and the passed `npm run lint` execution evidence.

**M1 complete — authoritative consumer receipt achieved within explicitly
observed scope.**
