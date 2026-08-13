# Scope and profiles

Policy explicitly supplies `includeGlobs` and `excludedGlobs`. The receipt lists paths actually scanned and excluded, globs that matched no file, and files that could not be loaded. An unmatched include glob or unloaded file makes scope incomplete and authority false.

`new` reports all findings and blocks on every blocking finding. `converge` records all findings too, marking a finding as `baseline: true` only when its exact fingerprint appears in a baseline entry containing a rationale and reviewer. Baseline blocking debt remains visible; an observed blocking fingerprint outside the reviewed baseline blocks.

The policy, glossary, and vocabulary are mandatory JSON data. Their absence, unreadability, or invalid shape is `Inconclusive`, never `Pass`.
