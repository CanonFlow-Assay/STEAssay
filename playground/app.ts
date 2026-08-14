import {
  ANALYZER_VERSION,
  matchesExpectedPreview,
  previewMarkdown,
  type PlaygroundPolicy,
} from "./preview.js";
import {
  bundledExamples,
  defaultExample,
  DEMONSTRATION_SOURCE_NOTE,
  getBundledExample,
  matchingPolicy,
  policyForExample,
  type PlaygroundExample,
} from "./samples.js";

const byId = <ElementType extends HTMLElement>(id: string): ElementType => {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing playground element: ${id}`);
  return element as ElementType;
};

const markdown = byId<HTMLTextAreaElement>("markdown");
const maxWords = byId<HTMLInputElement>("max-words");
const requirementMarker = byId<HTMLInputElement>("requirement-marker");
const requirementModal = byId<HTMLInputElement>("requirement-modal");
const glossary = byId<HTMLTextAreaElement>("glossary");
const bannedTerms = byId<HTMLTextAreaElement>("banned-terms");
const deprecatedTerms = byId<HTMLTextAreaElement>("deprecated-terms");
const terminology = byId<HTMLTextAreaElement>("terminology");
const imperativeVerbs = byId<HTMLTextAreaElement>("imperative-verbs");
const resultSummary = byId<HTMLElement>("result-summary");
const findingList = byId<HTMLElement>("findings");
const blockingCount = byId<HTMLElement>("blocking-count");
const advisoryCount = byId<HTMLElement>("advisory-count");
const correctedPreview = byId<HTMLTextAreaElement>("corrected-preview");
const errorMessage = byId<HTMLElement>("error-message");
const exampleSelector = byId<HTMLSelectElement>("example-selector");
const applyCorrections = byId<HTMLButtonElement>("apply-corrections");
const exampleTitle = byId<HTMLElement>("example-title");
const exampleDescription = byId<HTMLElement>("example-description");
const exampleSourceNote = byId<HTMLElement>("example-source-note");
const exampleLimitation = byId<HTMLElement>("example-limitation");
const expectedResult = byId<HTMLElement>("expected-result");
const observedResult = byId<HTMLElement>("observed-result");
const regression = byId<HTMLElement>("playground-regression");
const policySummary = byId<HTMLElement>("policy-summary");

let activeExample: PlaygroundExample | undefined = defaultExample;
let inputWasEdited = false;

const csv = (value: string): readonly string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

const lines = (value: string): readonly string[] =>
  value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter((item) => item !== "");

const valueOrNone = (value: string): string =>
  value.trim() === "" ? "none" : value.trim();

const glossaryKeys = (): string => {
  try {
    const parsed = JSON.parse(glossary.value) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return "invalid JSON";
    }
    const keys = Object.keys(parsed);
    return keys.length === 0 ? "none" : keys.join(", ");
  } catch {
    return "invalid JSON";
  }
};

const updatePolicySummary = (): void => {
  policySummary.textContent = `Limit: ${valueOrNone(maxWords.value)} words · markers: ${valueOrNone(requirementMarker.value)} · modals: ${valueOrNone(requirementModal.value)} · glossary: ${glossaryKeys()} · banned: ${valueOrNone(bannedTerms.value)} · deprecated: ${valueOrNone(deprecatedTerms.value)} · terminology: ${valueOrNone(terminology.value)} · imperatives: ${valueOrNone(imperativeVerbs.value)}`;
};

const splitPair = (
  line: string,
  label: string,
): { readonly left: string; readonly right: string | undefined } => {
  const [left, ...remaining] = line.split("=>");
  const normalizedLeft = left?.trim() ?? "";
  const normalizedRight = remaining.join("=>").trim();
  if (normalizedLeft === "") {
    throw new Error(`${label} entries must start with a term.`);
  }
  return {
    left: normalizedLeft,
    right: normalizedRight === "" ? undefined : normalizedRight,
  };
};

const readPolicy = (): PlaygroundPolicy => {
  const parsedGlossary = JSON.parse(glossary.value) as unknown;
  if (
    parsedGlossary === null ||
    typeof parsedGlossary !== "object" ||
    Array.isArray(parsedGlossary) ||
    Object.values(parsedGlossary).some(
      (value) => typeof value !== "string" || value.trim() === "",
    )
  ) {
    throw new Error(
      "Glossary must be a JSON object of abbreviation definitions.",
    );
  }
  const sentenceLimit = Number(maxWords.value);
  if (!Number.isInteger(sentenceLimit) || sentenceLimit < 1) {
    throw new Error("Sentence word limit must be a positive integer.");
  }
  const deprecated = lines(deprecatedTerms.value).map((line) => {
    const pair = splitPair(line, "Deprecated-term");
    return pair.right === undefined
      ? { term: pair.left }
      : { term: pair.left, replacement: pair.right };
  });
  const preferences = lines(terminology.value).map((line) => {
    const pair = splitPair(line, "Terminology");
    if (pair.right === undefined) {
      throw new Error(
        "Terminology entries must use canonical => alternate terms.",
      );
    }
    const inconsistent = csv(pair.right);
    if (inconsistent.length === 0) {
      throw new Error(
        "Terminology entries need at least one noncanonical term.",
      );
    }
    return { canonical: pair.left, inconsistent };
  });
  return {
    maxWords: sentenceLimit,
    glossary: { abbreviations: parsedGlossary as Record<string, string> },
    vocabulary: {
      bannedTerms: csv(bannedTerms.value),
      deprecatedTerms: deprecated,
      imperativeVerbs: csv(imperativeVerbs.value),
      terminology: preferences,
    },
    requirementMarkers: csv(requirementMarker.value),
    requirementModals: csv(requirementModal.value),
  };
};

const writePolicy = (policy: PlaygroundPolicy): void => {
  maxWords.value = String(policy.maxWords);
  requirementMarker.value = policy.requirementMarkers.join(", ");
  requirementModal.value = policy.requirementModals.join(", ");
  glossary.value = JSON.stringify(policy.glossary.abbreviations, null, 2);
  bannedTerms.value = policy.vocabulary.bannedTerms.join(", ");
  deprecatedTerms.value = policy.vocabulary.deprecatedTerms
    .map((entry) =>
      entry.replacement === undefined
        ? entry.term
        : `${entry.term} => ${entry.replacement}`,
    )
    .join("\n");
  terminology.value = policy.vocabulary.terminology
    .map((entry) => `${entry.canonical} => ${entry.inconsistent.join(", ")}`)
    .join("\n");
  imperativeVerbs.value = policy.vocabulary.imperativeVerbs.join(", ");
  updatePolicySummary();
};

const appendFinding = (
  parent: HTMLElement,
  finding: ReturnType<typeof previewMarkdown>["findings"][number],
): void => {
  const item = document.createElement("li");
  item.className = `finding finding-${finding.severity}`;
  item.tabIndex = 0;
  const titleRow = document.createElement("div");
  titleRow.className = "finding-title";
  const icon = document.createElement("span");
  icon.className = "finding-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = finding.severity === "blocking" ? "!" : "i";
  const severity = document.createElement("span");
  severity.className = "severity-label";
  severity.textContent =
    finding.severity === "blocking" ? "Blocking" : "Advisory";
  const title = document.createElement("strong");
  title.textContent = `${finding.ruleId} · line ${finding.position.line}, column ${finding.position.column}`;
  const message = document.createElement("p");
  message.className = "finding-message";
  message.textContent = finding.message;
  const excerpt = document.createElement("code");
  excerpt.textContent = finding.excerpt;
  const instruction = document.createElement("p");
  instruction.className = "finding-instruction";
  instruction.textContent = finding.correction
    ? `Safe correction: ${finding.correction.from} → ${finding.correction.to}.`
    : `Manual correction: ${finding.manualInstruction}`;
  titleRow.append(icon, severity, title);
  item.append(titleRow, message, excerpt, instruction);
  parent.append(item);
};

const renderFindings = (
  findings: ReturnType<typeof previewMarkdown>["findings"],
): void => {
  findingList.replaceChildren();
  for (const severity of ["blocking", "advisory"] as const) {
    const bySeverity = findings.filter(
      (finding) => finding.severity === severity,
    );
    if (bySeverity.length === 0) continue;
    const group = document.createElement("section");
    group.className = `finding-group finding-group-${severity}`;
    const heading = document.createElement("h3");
    heading.className = "finding-group-title";
    heading.textContent = `${severity === "blocking" ? "Blocking" : "Advisory"} findings (${bySeverity.length})`;
    const list = document.createElement("ul");
    list.className = "finding-items";
    bySeverity.forEach((finding) => appendFinding(list, finding));
    group.append(heading, list);
    findingList.append(group);
  }
};

const summaryFor = (
  findingCount: number,
  blockingCount: number,
  advisoryCount: number,
): string =>
  `${findingCount} findings: ${blockingCount} blocking, ${advisoryCount} advisory.`;

const updateExampleDetails = (): void => {
  if (activeExample === undefined) {
    exampleTitle.textContent = "Empty custom sample";
    exampleDescription.textContent =
      "User-written Markdown and project-owned local policy input.";
    exampleSourceNote.textContent =
      "Custom input is local to this browser and has no bundled expected result.";
    exampleLimitation.hidden = true;
    expectedResult.textContent = "Expected: no bundled expected result.";
    return;
  }
  exampleTitle.textContent = activeExample.title;
  exampleDescription.textContent = activeExample.description;
  exampleSourceNote.textContent = activeExample.sourceNote;
  exampleLimitation.textContent = activeExample.limitation ?? "";
  exampleLimitation.hidden = activeExample.limitation === undefined;
  const ruleIds = activeExample.expected.ruleIds.join(", ") || "none";
  expectedResult.textContent = `Expected: ${ruleIds}; ${activeExample.expected.blockingCount} blocking, ${activeExample.expected.advisoryCount} advisory.`;
};

const renderComparison = (result: ReturnType<typeof previewMarkdown>): void => {
  observedResult.textContent = `Observed: ${summaryFor(
    result.findings.length,
    result.blockingCount,
    result.advisoryCount,
  )}`;
  regression.hidden = true;
  regression.textContent = "";
  if (activeExample === undefined) return;
  if (inputWasEdited) {
    regression.textContent =
      "Observed result uses user-edited local input. Reset to example policy to compare the bundled specimen.";
    regression.hidden = false;
    return;
  }
  if (!matchesExpectedPreview(result, activeExample.expected)) {
    regression.textContent =
      "Playground regression: the observed result does not match this bundled specimen.";
    regression.hidden = false;
    return;
  }
  regression.textContent = "Observed result matches this bundled specimen.";
  regression.hidden = false;
};

const render = (): void => {
  errorMessage.textContent = "";
  try {
    const result = previewMarkdown(markdown.value, readPolicy());
    resultSummary.textContent = summaryFor(
      result.findings.length,
      result.blockingCount,
      result.advisoryCount,
    );
    correctedPreview.value = result.correctedMarkdown;
    blockingCount.textContent = String(result.blockingCount);
    advisoryCount.textContent = String(result.advisoryCount);
    applyCorrections.disabled = !result.findings.some(
      (finding) => finding.correction !== undefined,
    );
    renderFindings(result.findings);
    renderComparison(result);
  } catch (error) {
    resultSummary.textContent = "Preview input could not be analyzed.";
    correctedPreview.value = "";
    blockingCount.textContent = "0";
    advisoryCount.textContent = "0";
    findingList.replaceChildren();
    applyCorrections.disabled = true;
    observedResult.textContent =
      "Observed: preview input could not be analyzed.";
    regression.hidden = true;
    errorMessage.textContent = `Local policy error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const loadExample = (id: string): void => {
  const example = getBundledExample(id);
  activeExample = example;
  inputWasEdited = false;
  if (example === undefined) {
    markdown.value = "";
    writePolicy(matchingPolicy());
  } else {
    markdown.value = example.markdown;
    writePolicy(policyForExample(example));
  }
  updateExampleDetails();
  render();
};

for (const example of bundledExamples) {
  const option = document.createElement("option");
  option.value = example.id;
  option.textContent = example.title;
  exampleSelector.append(option);
}
const customOption = document.createElement("option");
customOption.value = "custom";
customOption.textContent = "Empty custom sample";
exampleSelector.append(customOption);

byId<HTMLButtonElement>("run-preview").addEventListener("click", render);
byId<HTMLButtonElement>("load-example").addEventListener("click", () => {
  loadExample(exampleSelector.value);
});
byId<HTMLButtonElement>("reset-to-example-policy").addEventListener(
  "click",
  () => {
    loadExample(exampleSelector.value);
  },
);
applyCorrections.addEventListener("click", () => {
  try {
    markdown.value = previewMarkdown(
      markdown.value,
      readPolicy(),
    ).correctedMarkdown;
    inputWasEdited = true;
    render();
  } catch (error) {
    errorMessage.textContent = `Local policy error: ${error instanceof Error ? error.message : String(error)}`;
  }
});

[
  markdown,
  maxWords,
  requirementMarker,
  requirementModal,
  glossary,
  bannedTerms,
  deprecatedTerms,
  terminology,
  imperativeVerbs,
].forEach((input) => {
  input.addEventListener("input", () => {
    inputWasEdited = true;
    updatePolicySummary();
  });
});

byId<HTMLElement>("analyzer-version").textContent = ANALYZER_VERSION;
exampleSelector.value = defaultExample.id;
exampleSourceNote.textContent = DEMONSTRATION_SOURCE_NOTE;
loadExample(defaultExample.id);
