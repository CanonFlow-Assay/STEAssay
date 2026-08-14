import type { ExpectedPreview, PlaygroundPolicy } from "./preview.js";

export const DEMONSTRATION_SOURCE_NOTE =
  "Bundled demonstration specimen. Not an external compliance claim.";

export interface PlaygroundExample {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
  readonly policy: Pick<
    PlaygroundPolicy,
    "maxWords" | "requirementMarkers" | "requirementModals"
  >;
  readonly glossary: PlaygroundPolicy["glossary"];
  readonly vocabulary: PlaygroundPolicy["vocabulary"];
  readonly expected: ExpectedPreview;
  readonly sourceNote: typeof DEMONSTRATION_SOURCE_NOTE;
  readonly limitation?: string;
}

type PlaygroundExampleDefinition = Omit<
  PlaygroundExample,
  "policy" | "glossary" | "vocabulary"
> & {
  readonly policy: PlaygroundPolicy;
};

const policy = (
  overrides: Partial<PlaygroundPolicy> = {},
): PlaygroundPolicy => ({
  maxWords: 12,
  glossary: { abbreviations: {} },
  vocabulary: {
    bannedTerms: [],
    deprecatedTerms: [],
    imperativeVerbs: [],
    terminology: [],
  },
  requirementMarkers: [],
  requirementModals: [],
  ...overrides,
});

export const matchingPolicy = (): PlaygroundPolicy =>
  policy({
    glossary: {
      abbreviations: {
        API: "Application Programming Interface",
      },
    },
    vocabulary: {
      bannedTerms: ["robust"],
      deprecatedTerms: [{ term: "whitelist", replacement: "allow list" }],
      imperativeVerbs: ["open", "run"],
      terminology: [{ canonical: "service", inconsistent: ["daemon"] }],
    },
    requirementMarkers: ["Requirement"],
    requirementModals: ["must"],
  });

export const compliantSample = `# Install the tool

Use the API to install the tool.

Requirement: The operator must run the lint command.
`;

export const offenderSample = `#
Open and run the API checker with a robust whitelist daemon before you write the release evidence because the service may contain results that are difficult for a new operator to inspect correctly.
Requirement: Record the test output.
The package was installed.
`;

const sentenceLengthMarkdown = `# Sentence policy

Record each measured value before release approval and publish the summarized result for review today.
`;

const specimen = (
  definition: PlaygroundExampleDefinition,
): PlaygroundExample => {
  const { policy: configuration, ...example } = definition;
  return {
    ...example,
    policy: {
      maxWords: configuration.maxWords,
      requirementMarkers: configuration.requirementMarkers,
      requirementModals: configuration.requirementModals,
    },
    glossary: configuration.glossary,
    vocabulary: configuration.vocabulary,
  };
};

export const policyForExample = (
  example: PlaygroundExample,
): PlaygroundPolicy => ({
  ...example.policy,
  glossary: example.glossary,
  vocabulary: example.vocabulary,
});

export const bundledExamples: readonly PlaygroundExample[] = [
  specimen({
    id: "installation-guide",
    title: "Compliant installation guide",
    description:
      "A short installation guide with basic policy, glossary, and requirement text.",
    markdown: compliantSample,
    policy: matchingPolicy(),
    expected: { ruleIds: [], blockingCount: 0, advisoryCount: 0 },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
  }),
  specimen({
    id: "release-procedure-offender",
    title: "Release procedure offender",
    description:
      "A release procedure that demonstrates every current rule type and the two deterministic safe corrections.",
    markdown: offenderSample,
    policy: matchingPolicy(),
    expected: {
      ruleIds: [
        "STE-S01",
        "STE-S02",
        "STE-S04",
        "STE-S05",
        "STE-S06",
        "STE-S08",
        "STE-S09",
        "STE-S10",
      ],
      blockingCount: 4,
      advisoryCount: 4,
    },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
  }),
  specimen({
    id: "api-reference-note",
    title: "API reference note",
    description:
      "An API note whose local glossary defines API but intentionally omits SDK.",
    markdown: `# API reference

The API returns an SDK response.
`,
    policy: policy({
      glossary: {
        abbreviations: { API: "Application Programming Interface" },
      },
    }),
    expected: { ruleIds: ["STE-S03"], blockingCount: 1, advisoryCount: 0 },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
  }),
  specimen({
    id: "operations-runbook",
    title: "Operations runbook",
    description:
      "An operations instruction that shows one-action instructions and configured requirement modal language.",
    markdown: `# Operations runbook

Open and run the diagnostics.
Requirement: Record the result.
`,
    policy: policy({
      vocabulary: {
        bannedTerms: [],
        deprecatedTerms: [],
        imperativeVerbs: ["open", "run"],
        terminology: [],
      },
      requirementMarkers: ["Requirement"],
      requirementModals: ["must"],
    }),
    expected: {
      ruleIds: ["STE-S06", "STE-S09"],
      blockingCount: 0,
      advisoryCount: 2,
    },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
  }),
  specimen({
    id: "terminology-migration",
    title: "Terminology migration",
    description:
      "A terminology migration with only deterministic deprecated-term and canonical-terminology corrections.",
    markdown: `# Terminology migration

The whitelist daemon remains active.
`,
    policy: policy({
      vocabulary: {
        bannedTerms: [],
        deprecatedTerms: [{ term: "whitelist", replacement: "allow list" }],
        imperativeVerbs: [],
        terminology: [{ canonical: "service", inconsistent: ["daemon"] }],
      },
    }),
    expected: {
      ruleIds: ["STE-S08", "STE-S10"],
      blockingCount: 1,
      advisoryCount: 1,
    },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
  }),
  specimen({
    id: "sentence-length-12",
    title: "Sentence-length policy comparison — 12-word policy",
    description:
      "The same sentence is evaluated with a 12-word limit, which reports the configured length finding.",
    markdown: sentenceLengthMarkdown,
    policy: policy({ maxWords: 12 }),
    expected: { ruleIds: ["STE-S01"], blockingCount: 1, advisoryCount: 0 },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
    limitation:
      "Tokenizer limitation: sentence boundaries use simple punctuation. Abbreviations, URLs, versions, and decimals can split unexpectedly.",
  }),
  specimen({
    id: "sentence-length-25",
    title: "Sentence-length policy comparison — 25-word policy",
    description:
      "The same sentence is evaluated with a 25-word limit, which produces no length finding.",
    markdown: sentenceLengthMarkdown,
    policy: policy({ maxWords: 25 }),
    expected: { ruleIds: [], blockingCount: 0, advisoryCount: 0 },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
    limitation:
      "Tokenizer limitation: sentence boundaries use simple punctuation. Abbreviations, URLs, versions, and decimals can split unexpectedly.",
  }),
  specimen({
    id: "unicode-boundary",
    title: "Unicode boundary example",
    description:
      "A configured banned term demonstrates that only standalone cat matches; attached Latin, accented, Cyrillic, digit, and underscore forms do not.",
    markdown: `# Unicode boundary

scat catapult cat écat caté котcat catёж cat2 2cat cat_value _cat
`,
    policy: policy({
      vocabulary: {
        bannedTerms: ["cat"],
        deprecatedTerms: [],
        imperativeVerbs: [],
        terminology: [],
      },
    }),
    expected: { ruleIds: ["STE-S04"], blockingCount: 1, advisoryCount: 0 },
    sourceNote: DEMONSTRATION_SOURCE_NOTE,
  }),
] as const;

export const getBundledExample = (id: string): PlaygroundExample | undefined =>
  bundledExamples.find((example) => example.id === id);

export const defaultExample = bundledExamples[0];
