# Evidence model

`verify` writes canonical `receipt.json` and SARIF. The receipt binds the tool version; Node/npm runtime; source-content digest; policy, glossary, vocabulary, and rule-catalog digests; scanned/excluded/unmatched/unloaded scope; ordered findings and digest; required command executable/argument vectors with status, exit code, and output digest; verdict; authority flag; and explicit limitations. Receipt schema version 2 identifies the structured command representation.

Set `STE_ASSAY_CLOCK` to an ISO-8601 instant for reproducible fixture receipts. JSON keys use canonical ordering; arrays that represent observations are sorted deterministically. SARIF results use the same finding order.

Required command statuses are `NotRun`, `Passed`, `Failed`, or `Unavailable`. `scan` never represents a configured required command as passed. `verify` cannot be authoritative unless every required command passed and scope was complete.

## Required-command trust boundary

`verify` invokes each policy version 2 `requiredCommands` entry as an explicit
executable and literal argument vector, with the target root as its working
directory. It uses no shell: shell quoting, chaining, redirection, expansion,
and substitution are passed as ordinary argument text and cannot alter process
selection. The receipt preserves the exact executable and ordered argument
array, plus status, exit code, and output digest.

This is a narrower execution model, not a sandbox. A repository-controlled
policy can still choose any executable available to the invoking user and pass
it arbitrary arguments. Treat policy changes with the same review level as CI
workflow changes; do not execute fork-controlled policy with repository secrets.
Version 1 command-string policies are rejected and never executed.
