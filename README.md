# STEAssay

STEAssay is a deterministic verifier for the mechanically decidable portion of a project-owned controlled technical-writing policy. It scans Markdown only. It complements the [ASD-STE100 skill](https://github.com/danyuchn/asd-ste100-skill): the skill helps an author or agent write; STEAssay checks explicit, observable conditions after text has been written.

Its governing law is:

> authority ≤ evidence ≤ observed scope

It reports only `Pass`, `Fail`, `Inconclusive`, or `ToolFailure`. A `Pass` means only that this pinned tool, configuration, supplied glossary and vocabulary, requested Markdown scope, and configured command evidence observed no blocking violation. It does not prove ASD-STE100 compliance, text quality, safety, correctness, translation quality, or absence of ambiguity.

## Commands

```text
ste-assay doctor <path>
ste-assay scan <path>
ste-assay verify <path>
ste-assay explain <rule-id>
```

`doctor` checks toolchain/configuration readiness and makes no compliance claim. `scan` performs static Markdown observation; if policy requires commands, they are explicitly `NotRun` and the result is non-authoritative. `verify` runs each configured executable and literal argument vector without a shell, recording the executable, arguments, status, exit code, and output digest. Policy is still trusted process-execution input and must be reviewed before `verify` is run. Every command produces a readable terminal report plus canonical JSON and SARIF in `<path>/.ste-assay/`.

## Quick start

```bash
npm ci
npm run build
node dist/src/cli.js verify examples/minimal
```

See [examples/minimal](examples/minimal) for a complete local policy, glossary, and vocabulary. The vocabulary is supplied by the project; STEAssay ships no ASD-STE100 dictionary, avoid list, or standard text.

`policy.version` is `2`. Each `requiredCommands` item is a non-empty JSON
array: the first string is the executable and later strings are literal
arguments. For example, `["npm", "run", "test"]` runs exactly that process
vector. Shell strings, quoting, chaining, redirection, and expansion are not
accepted. Version 1 policies are rejected without execution; see the
[M3 command-boundary design](docs/m3-required-commands.md) for migration and
trust limits.

## Playground

[Open the GitHub Pages playground](https://canonflow-assay.github.io/STEAssay/). It is a local browser preview: Markdown, custom policy, glossary, and vocabulary stay in the browser and are never uploaded or executed. The playground never runs `requiredCommands`, makes no authoritative claim, and does not replace the CLI. Only `ste-assay verify` can provide authoritative project verification when its configured scope and command evidence are complete.

The playground can apply only configured deprecated-term and terminology replacements. It never guesses corrections for sentence length, headings, passive voice, or requirement language, and its preview does not certify ASD-STE100 compliance.

Bundled demonstration specimens include compliant and offender guides, abbreviation and requirement examples, terminology migration, sentence-length policy comparison, and Unicode term boundaries. Each specimen identifies its expected local preview result and carries the source note “Bundled demonstration specimen. Not an external compliance claim.” User edits remain local to the browser; **Reset to example policy** restores the selected bundled specimen. The simple punctuation tokenizer has known sentence-boundary limits for abbreviations, URLs, versions, and decimals.

## What it checks

Blocking rules are deterministic syntax or configured-data checks: sentence word count, empty headings, undeclared uppercase abbreviations, configured banned terms, and configured deprecated terms. Passive-voice, multiple imperative actions, modal use, and terminology preference checks are advisory only. See [the rule catalogue](docs/rule-catalog.md).

## Profiles

`new` treats every observed blocking finding as new. `converge` keeps a reviewed fingerprint baseline visible in the receipt; only an observed blocking finding not in that baseline fails. A baseline never erases a finding. See [scope and profiles](docs/scope-and-profiles.md).

## Boundaries

STEAssay is not an LLM, authoring tool, rewrite engine, editor extension, CI service, ASD-STE100 implementation, or a source of protected vocabulary. It neither distributes nor infers an ASD-approved dictionary. See [licensing boundary](docs/licensing-boundary.md) and [philosophy](docs/philosophy.md).

## Development

Node `20.20.2` and npm `10.8.2` are pinned for authoring and CI.

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Licensed under [Apache-2.0](LICENSE).
