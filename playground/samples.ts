import type { PlaygroundPolicy } from "./preview.js";

export const offenderSample = `#
Open and run the API checker with a robust whitelist daemon before you write the release evidence because the service may contain results that are difficult for a new operator to inspect correctly.
Requirement: Record the test output.
The package was installed.
`;

export const compliantSample = `# Install the tool

Use the API to install the tool.

Requirement: The operator must run the lint command.
`;

export const matchingPolicy = (): PlaygroundPolicy => ({
  maxWords: 12,
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
