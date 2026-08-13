import { canonicalJson, sha256 } from "./canonical.js";
import type { Severity } from "./model.js";

export interface RuleDefinition {
  readonly id: string;
  readonly severity: Severity;
  readonly title: string;
  readonly rationale: string;
  readonly mechanism: string;
  readonly falsifier: string;
}

export const ruleCatalog: readonly RuleDefinition[] = [
  {
    id: "STE-S01",
    severity: "blocking",
    title: "Sentence exceeds configured word limit",
    rationale:
      "A project can set a measured sentence-length limit for its observed Markdown prose.",
    mechanism: "Counts documented word tokens in each parsed prose sentence.",
    falsifier:
      "A sentence with no more than the configured number of word tokens does not produce this finding.",
  },
  {
    id: "STE-S02",
    severity: "blocking",
    title: "Heading is empty",
    rationale: "An empty Markdown heading supplies no navigable topic.",
    mechanism:
      "Checks ATX and setext headings after Markdown marker and inline-markup normalization.",
    falsifier:
      "A heading with visible normalized text does not produce this finding.",
  },
  {
    id: "STE-S03",
    severity: "blocking",
    title: "Abbreviation is not in the configured glossary",
    rationale:
      "Projects can require locally declared abbreviations without distributing an external vocabulary.",
    mechanism:
      "Matches all-uppercase abbreviation tokens and compares them exactly to glossary keys.",
    falsifier:
      "An exact configured glossary key does not produce this finding.",
  },
  {
    id: "STE-S04",
    severity: "blocking",
    title: "Configured banned term occurs",
    rationale: "A project can make a specific supplied term forbidden.",
    mechanism: "Matches configured case-insensitive whole terms or phrases.",
    falsifier:
      "Text without a configured banned term does not produce this finding.",
  },
  {
    id: "STE-S05",
    severity: "advisory",
    title: "Passive-voice pattern",
    rationale:
      "Passive-looking constructions need human interpretation; they are never build-blocking in this tool.",
    mechanism: "Reports a documented auxiliary-plus-participle pattern.",
    falsifier: "A sentence without the pattern does not produce this advisory.",
  },
  {
    id: "STE-S06",
    severity: "advisory",
    title: "More than one configured imperative action",
    rationale:
      "A project may inspect multiple configured action words, but grammar remains advisory.",
    mechanism: "Counts exact configured imperative-verb tokens in a sentence.",
    falsifier:
      "A sentence with zero or one configured imperative token does not produce this advisory.",
  },
  {
    id: "STE-S08",
    severity: "blocking",
    title: "Configured deprecated term occurs",
    rationale:
      "A project can require replacement of a specifically supplied deprecated term.",
    mechanism:
      "Matches configured case-insensitive whole terms or phrases and reports supplied replacement metadata.",
    falsifier:
      "Text without a configured deprecated term does not produce this finding.",
  },
  {
    id: "STE-S09",
    severity: "advisory",
    title: "Requirement sentence lacks configured modal language",
    rationale:
      "Whether a sentence is a requirement is contextual; this configurable signal is advisory only.",
    mechanism:
      "Detects a configured marker without any configured modal term in the same sentence.",
    falsifier:
      "A marked sentence containing a configured modal does not produce this advisory.",
  },
  {
    id: "STE-S10",
    severity: "advisory",
    title: "Configured terminology inconsistency",
    rationale:
      "Terminology preferences are project-owned data, not an external standard dictionary.",
    mechanism:
      "Reports configured noncanonical alternatives by exact case-insensitive term matching.",
    falsifier:
      "Text without a configured noncanonical alternative does not produce this advisory.",
  },
];

export const catalogDigest = sha256(canonicalJson(ruleCatalog));

export const findRule = (id: string): RuleDefinition | undefined =>
  ruleCatalog.find((rule) => rule.id === id);
