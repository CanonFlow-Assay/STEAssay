# Evidence model

`verify` writes canonical `receipt.json` and SARIF. The receipt binds the tool version; Node/npm runtime; source-content digest; policy, glossary, vocabulary, and rule-catalog digests; scanned/excluded/unmatched/unloaded scope; ordered findings and digest; required commands with status, exit code, and output digest; verdict; authority flag; and explicit limitations.

Set `STE_ASSAY_CLOCK` to an ISO-8601 instant for reproducible fixture receipts. JSON keys use canonical ordering; arrays that represent observations are sorted deterministically. SARIF results use the same finding order.

Required command statuses are `NotRun`, `Passed`, `Failed`, or `Unavailable`. `scan` never represents a configured required command as passed. `verify` cannot be authoritative unless every required command passed and scope was complete.
