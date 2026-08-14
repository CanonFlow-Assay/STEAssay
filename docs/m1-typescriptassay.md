# M1 — TypeScriptAssay evidence exercise

This evidence-only slice ran the published stable TypeScriptAssay package
against the explicitly selected STEAssay TypeScript source at
`e4f914cfa25ea1fbcea79dc6146312cef906fda0`.

The final `verify` receipt is `Pass` and `authoritative: true` within the
observed scope. Its meaning is bounded by the governing law:

> authority ≤ evidence ≤ observed scope

## Tool and scope

The exercise used `typescript-assay@0.1.1`, with registry integrity
`sha512-iu2ecPYRDI+gXWy67nfoUyaxZKdtRG49clmdiVnWYw/0ylmxrQ7CXva6nwcYsxoSdohB0n2gi5pkLIUQGD+0dg==`,
Node `v20.20.2`, npm `10.8.2`, and TypeScript `5.7.3`. The package receipt
self-reports CLI `0.1.0`; the evidence records this discrepancy without
making a compatibility claim.

The policy selects these first-party files only:

- `src/**/*.ts`
- `playground/**/*.ts`
- `tests/**/*.ts`

It excludes `dist`, `node_modules`, previous assay output, built playground
JavaScript, tarballs, and non-TypeScript fixtures. The exact 16 parsed files,
682 observed excluded paths, empty unloaded-path set, and unmatched exclusion
globs are in the [scope manifest](evidence/m1-typescriptassay/scope-manifest.json).

## Result

The initial `new` scan made 45 findings visible: 29 blocking errors and 16
`TSA-B03` warnings. The exact 29 errors were then captured as a reviewed,
visible converge baseline—never deleted. The final receipt contains:

| Rule    | Severity | Findings | Baselined |
| ------- | -------- | -------: | --------: |
| TSA-B01 | error    |        4 |         4 |
| TSA-B03 | warning  |       16 |         0 |
| TSA-D01 | error    |        3 |         3 |
| TSA-D03 | error    |        2 |         2 |
| TSA-E02 | error    |        2 |         2 |
| TSA-I02 | error    |       18 |        18 |

The required `format:check`, `lint`, `typecheck`, `test`, `build`, and
`test:playwright` commands all passed in the authoritative receipt.

All required adversarial exercises were non-authoritative: invalid policy,
missing selected source, and missing target returned `ToolFailure`; unrun
commands and incomplete source scope returned `Inconclusive`; a source change
after the receipt returned `Fail` with an unbaselined `TSA-D01`; and an
unavailable command returned `ToolFailure`. Details are in
[adversarial results](evidence/m1-typescriptassay/adversarial-results.json).

## Replay and limits

The complete bundle is in [evidence/m1-typescriptassay](evidence/m1-typescriptassay/).
Verify it with:

```sh
cd docs/evidence/m1-typescriptassay
sha256sum -c SHA256SUMS
```

This is static, configured observation only. It does not establish deep
runtime immutability, runtime validation completeness, security, purity,
business correctness, or correctness outside the selected TypeScript paths.
The policy contains shell-executed required commands and therefore receives
the same review level as CI workflow configuration.
