# Evidence model

`verify` writes canonical `receipt.json` and SARIF. The receipt binds the tool version; Node/npm runtime; source-content digest; policy, glossary, vocabulary, and rule-catalog digests; scanned/excluded/unmatched/unloaded scope; ordered findings and digest; required commands with status, exit code, and output digest; verdict; authority flag; and explicit limitations.

Set `STE_ASSAY_CLOCK` to an ISO-8601 instant for reproducible fixture receipts. JSON keys use canonical ordering; arrays that represent observations are sorted deterministically. SARIF results use the same finding order.

Required command statuses are `NotRun`, `Passed`, `Failed`, or `Unavailable`. `scan` never represents a configured required command as passed. `verify` cannot be authoritative unless every required command passed and scope was complete.

## Required-command trust boundary

`verify` invokes each policy `requiredCommands` entry as a complete command string through the platform shell, with the target root as its working directory. This supports ordinary project commands with arguments, quoting, chaining, and redirection; it also means that a repository-controlled policy can execute arbitrary shell syntax and any program available to the invoking user. The policy and its referenced files are therefore trusted executable input. STEAssay does not sandbox these commands. The receipt preserves the configured command string plus its status, exit code, and output digest, but it cannot make an untrusted policy safe.
