# Rule catalogue

Every rule is evaluated only in scanned Markdown prose, except the heading check. Findings are sorted by normalized path, source location, then rule ID.

| ID      | Severity | Source/mechanism                                                                                                                          | Falsifier                                                 |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| STE-S01 | Blocking | Project policy supplies a positive word limit. The scanner counts Unicode letter/number tokens, permitting internal apostrophe or hyphen. | A parsed prose sentence at or below the configured count. |
| STE-S02 | Blocking | Markdown syntax. The scanner finds ATX/setext headings and normalizes simple inline markup before testing visible text.                   | A heading with visible normalized text.                   |
| STE-S03 | Blocking | Project glossary data. All-uppercase tokens of two or more characters are compared exactly with glossary keys.                            | A matching glossary key.                                  |
| STE-S04 | Blocking | Project vocabulary data. Case-insensitive whole configured terms/phrases are matched.                                                     | No configured banned-term match.                          |
| STE-S05 | Advisory | A documented auxiliary-plus-participle pattern. This is a heuristic, not a grammar proof.                                                 | No pattern match.                                         |
| STE-S06 | Advisory | Exact occurrences of project-configured imperative verb tokens are counted per sentence.                                                  | Zero or one configured action token.                      |
| STE-S08 | Blocking | Project vocabulary data. Case-insensitive whole deprecated terms/phrases are matched; supplied replacement metadata is reported.          | No configured deprecated-term match.                      |
| STE-S09 | Advisory | A sentence with a project-configured requirement marker but no configured modal is reported. Requirement interpretation is contextual.    | A marked sentence containing a configured modal.          |
| STE-S10 | Advisory | Project vocabulary names noncanonical alternatives and a preferred term; alternatives are matched as configured data.                     | No configured alternative occurrence.                     |

The catalogue is not a statement of full ASD-STE100 compliance. No heuristic in this table can block a build.

## STE-S01 sentence-boundary limitation

For this rule, a parsed prose sentence ends at one or more period, exclamation-mark, or question-mark characters. The tokenizer intentionally has no abbreviation, version, URL, decimal, or natural-language exceptions. Consequently, `U.S.`, `e.g.`, `1.2.3`, `example.com`, and `3.14` can split a prose span before its total word count reaches the configured limit. This can produce a false negative relative to a human reading the entire span as one sentence. The rule remains a deterministic measurement of this documented tokenizer, not a general sentence parser.
