import {
  ANALYZER_VERSION,
  previewMarkdown,
  type PlaygroundPolicy,
} from "./preview.js";
import { compliantSample, matchingPolicy, offenderSample } from "./samples.js";

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
const correctedPreview = byId<HTMLTextAreaElement>("corrected-preview");
const errorMessage = byId<HTMLElement>("error-message");
const sampleSelector = byId<HTMLSelectElement>("sample-selector");

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
};

const appendFinding = (
  finding: ReturnType<typeof previewMarkdown>["findings"][number],
): void => {
  const item = document.createElement("li");
  item.className = `finding finding-${finding.severity}`;
  const title = document.createElement("strong");
  title.textContent = `${finding.ruleId} · ${finding.severity} · line ${finding.position.line}, column ${finding.position.column}`;
  const message = document.createElement("p");
  message.textContent = finding.message;
  const excerpt = document.createElement("code");
  excerpt.textContent = finding.excerpt;
  const instruction = document.createElement("p");
  instruction.textContent = finding.correction
    ? `Safe correction: ${finding.correction.from} → ${finding.correction.to}.`
    : `Manual correction: ${finding.manualInstruction}`;
  item.append(title, message, excerpt, instruction);
  findingList.append(item);
};

const render = (): void => {
  errorMessage.textContent = "";
  findingList.replaceChildren();
  try {
    const policy = readPolicy();
    const result = previewMarkdown(markdown.value, policy);
    resultSummary.textContent = `${result.findings.length} findings: ${result.blockingCount} blocking, ${result.advisoryCount} advisory.`;
    correctedPreview.value = result.correctedMarkdown;
    result.findings.forEach(appendFinding);
  } catch (error) {
    resultSummary.textContent = "Preview input could not be analyzed.";
    correctedPreview.value = "";
    errorMessage.textContent =
      error instanceof Error ? error.message : String(error);
  }
};

const loadSample = (sample: "compliant" | "offender" | "custom"): void => {
  writePolicy(matchingPolicy());
  markdown.value =
    sample === "compliant"
      ? compliantSample
      : sample === "offender"
        ? offenderSample
        : "";
  render();
};

byId<HTMLButtonElement>("run-preview").addEventListener("click", render);
byId<HTMLButtonElement>("load-selected").addEventListener("click", () => {
  loadSample(sampleSelector.value as "compliant" | "offender" | "custom");
});
byId<HTMLButtonElement>("load-custom").addEventListener("click", () => {
  sampleSelector.value = "custom";
  loadSample("custom");
});
byId<HTMLButtonElement>("apply-corrections").addEventListener("click", () => {
  try {
    markdown.value = previewMarkdown(
      markdown.value,
      readPolicy(),
    ).correctedMarkdown;
    render();
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : String(error);
  }
});
byId<HTMLButtonElement>("reset").addEventListener("click", () => {
  sampleSelector.value = "compliant";
  loadSample("compliant");
});

byId<HTMLElement>("analyzer-version").textContent = ANALYZER_VERSION;
loadSample("compliant");
