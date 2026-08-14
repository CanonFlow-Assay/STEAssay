# TypeScriptAssay M2 baseline-triage evidence

This bundle records the M2 follow-up to the M1 TypeScriptAssay receipt. The
observed source revision is `a1b518071f842330f00134dba6892d90a9e84e0e`.

M2 made three behavior-preserving parser collection changes, each covered by a
focused characterization test. The second receipt is `Pass` with
`authoritative: true` for the same explicit 16-file TypeScript scope and
required commands. It has 42 visible findings: 26 reviewed blocking baselines
and 16 TSA-B03 warnings. It has no new unbaselined blocking finding.

`baseline-delta.json` binds the change from 29 to 26 blocking baselines. It
lists the three removed TSA-I02 fingerprints and every retained fingerprint.
The removed entries are absent only because the corresponding source operation
was fixed; the M1 receipt and policy remain unchanged.

Verify the recorded evidence bytes with:

```sh
cd docs/evidence/m2-typescriptassay-baseline-triage
sha256sum -c SHA256SUMS
```

The policy is trusted repository input. TypeScriptAssay executes its required
commands through a shell, so this policy receives CI-workflow-level review.
The replay workflow uses read-only permissions, provides no secrets, and skips
fork pull requests. The evidence remains bounded static observation; it does
not prove runtime behavior, browser safety, security, or correctness outside
the declared scope.
