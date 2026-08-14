import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { normalizePath, sha256 } from "./canonical.js";
import type {
  BaselineEntry,
  Glossary,
  LoadedConfiguration,
  Policy,
  RequiredCommand,
  Vocabulary,
} from "./model.js";

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigurationError(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
};

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigurationError(`${label} must be a non-empty string.`);
  }
  return value;
};

const stringArray = (value: unknown, label: string): readonly string[] => {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw new ConfigurationError(
      `${label} must be an array of non-empty strings.`,
    );
  }
  return value;
};

const requiredCommands = (value: unknown): readonly RequiredCommand[] => {
  if (!Array.isArray(value)) {
    throw new ConfigurationError(
      "policy.requiredCommands must be an array of non-empty command-and-argument arrays.",
    );
  }
  return value.map((command, commandIndex) => {
    const label = `policy.requiredCommands[${commandIndex}]`;
    if (
      !Array.isArray(command) ||
      command.length === 0 ||
      command.some(
        (argument) => typeof argument !== "string" || argument.trim() === "",
      )
    ) {
      throw new ConfigurationError(
        `${label} must be a non-empty array of non-empty strings; its first item is the executable and later items are literal arguments.`,
      );
    }
    return [command[0] as string, ...(command.slice(1) as string[])];
  });
};

const parseJson = (text: string, label: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ConfigurationError(`${label} is not valid JSON: ${detail}`);
  }
};

const parseBaseline = (value: unknown): readonly BaselineEntry[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ConfigurationError("policy.baseline must be an array.");
  }
  return value.map((item, index) => {
    const record = asRecord(item, `policy.baseline[${index}]`);
    return {
      fingerprint: requiredString(
        record.fingerprint,
        `policy.baseline[${index}].fingerprint`,
      ),
      rationale: requiredString(
        record.rationale,
        `policy.baseline[${index}].rationale`,
      ),
      reviewedBy: requiredString(
        record.reviewedBy,
        `policy.baseline[${index}].reviewedBy`,
      ),
    };
  });
};

const parsePolicy = (text: string): Policy => {
  const record = asRecord(parseJson(text, "Policy"), "Policy");
  if (record.version === 1) {
    throw new ConfigurationError(
      'policy.version 1 uses legacy shell command strings and is not executed. Migrate to policy.version 2 with requiredCommands entries such as ["npm", "run", "test"].',
    );
  }
  if (record.version !== 2) {
    throw new ConfigurationError("policy.version must be 2.");
  }
  if (record.profile !== "new" && record.profile !== "converge") {
    throw new ConfigurationError('policy.profile must be "new" or "converge".');
  }
  const rules = asRecord(record.rules, "policy.rules");
  const sentence = asRecord(rules["STE-S01"], "policy.rules.STE-S01");
  const maxWords = sentence.maxWords;
  if (
    typeof maxWords !== "number" ||
    !Number.isInteger(maxWords) ||
    maxWords < 1
  ) {
    throw new ConfigurationError(
      "policy.rules.STE-S01.maxWords must be a positive integer.",
    );
  }
  const requirement = asRecord(rules["STE-S09"], "policy.rules.STE-S09");
  return {
    version: 2,
    profile: record.profile,
    includeGlobs: stringArray(record.includeGlobs, "policy.includeGlobs"),
    excludedGlobs: stringArray(
      record.excludedGlobs ?? [],
      "policy.excludedGlobs",
    ),
    glossaryPath: requiredString(record.glossaryPath, "policy.glossaryPath"),
    vocabularyPath: requiredString(
      record.vocabularyPath,
      "policy.vocabularyPath",
    ),
    requiredCommands: requiredCommands(record.requiredCommands ?? []),
    rules: {
      "STE-S01": { maxWords },
      "STE-S09": {
        markers: stringArray(
          requirement.markers,
          "policy.rules.STE-S09.markers",
        ),
        modals: stringArray(requirement.modals, "policy.rules.STE-S09.modals"),
      },
    },
    baseline: parseBaseline(record.baseline),
  };
};

const parseGlossary = (text: string): Glossary => {
  const record = asRecord(parseJson(text, "Glossary"), "Glossary");
  const abbreviations = asRecord(
    record.abbreviations,
    "glossary.abbreviations",
  );
  for (const [key, value] of Object.entries(abbreviations)) {
    if (
      !/^[A-Z][A-Z0-9-]{1,}$/.test(key) ||
      typeof value !== "string" ||
      value.trim() === ""
    ) {
      throw new ConfigurationError(
        "glossary.abbreviations must map uppercase abbreviation keys to non-empty definitions.",
      );
    }
  }
  return {
    abbreviations: Object.fromEntries(
      Object.entries(abbreviations)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, value as string]),
    ),
  };
};

const parseVocabulary = (text: string): Vocabulary => {
  const record = asRecord(parseJson(text, "Vocabulary"), "Vocabulary");
  const deprecated = record.deprecatedTerms;
  if (!Array.isArray(deprecated)) {
    throw new ConfigurationError(
      "vocabulary.deprecatedTerms must be an array.",
    );
  }
  const terminology = record.terminology;
  if (!Array.isArray(terminology)) {
    throw new ConfigurationError("vocabulary.terminology must be an array.");
  }
  return {
    bannedTerms: stringArray(record.bannedTerms, "vocabulary.bannedTerms"),
    deprecatedTerms: deprecated.map((entry, index) => {
      const item = asRecord(entry, `vocabulary.deprecatedTerms[${index}]`);
      const replacement = item.replacement;
      if (
        replacement !== undefined &&
        (typeof replacement !== "string" || replacement.trim() === "")
      ) {
        throw new ConfigurationError(
          `vocabulary.deprecatedTerms[${index}].replacement must be a non-empty string when supplied.`,
        );
      }
      return {
        term: requiredString(
          item.term,
          `vocabulary.deprecatedTerms[${index}].term`,
        ),
        replacement,
      };
    }),
    imperativeVerbs: stringArray(
      record.imperativeVerbs,
      "vocabulary.imperativeVerbs",
    ),
    terminology: terminology.map((entry, index) => {
      const item = asRecord(entry, `vocabulary.terminology[${index}]`);
      return {
        canonical: requiredString(
          item.canonical,
          `vocabulary.terminology[${index}].canonical`,
        ),
        inconsistent: stringArray(
          item.inconsistent,
          `vocabulary.terminology[${index}].inconsistent`,
        ),
      };
    }),
  };
};

const fileDigest = (text: string): string => sha256(text);

const resolveDataPath = (policyPath: string, configuredPath: string): string =>
  isAbsolute(configuredPath)
    ? configuredPath
    : resolve(dirname(policyPath), configuredPath);

const displayPath = (root: string, path: string): string =>
  normalizePath(relative(root, path)) || ".";

export const discoverPolicyPath = (target: string): string =>
  resolve(target, ".steassay.json");

export const loadConfiguration = async (
  root: string,
): Promise<LoadedConfiguration> => {
  const policyPath = discoverPolicyPath(root);
  let policyText: string;
  try {
    policyText = await readFile(policyPath, "utf8");
  } catch (error) {
    const detail =
      error instanceof Error
        ? ((error as NodeJS.ErrnoException).code ?? error.message)
        : String(error);
    throw new ConfigurationError(
      `Policy cannot be read at ${displayPath(root, policyPath)}: ${detail}`,
    );
  }
  const policy = parsePolicy(policyText);
  const glossaryPath = resolveDataPath(policyPath, policy.glossaryPath);
  const vocabularyPath = resolveDataPath(policyPath, policy.vocabularyPath);
  let glossaryText: string;
  let vocabularyText: string;
  try {
    glossaryText = await readFile(glossaryPath, "utf8");
  } catch (error) {
    const detail =
      error instanceof Error
        ? ((error as NodeJS.ErrnoException).code ?? error.message)
        : String(error);
    throw new ConfigurationError(
      `Glossary cannot be read at ${displayPath(root, glossaryPath)}: ${detail}`,
    );
  }
  try {
    vocabularyText = await readFile(vocabularyPath, "utf8");
  } catch (error) {
    const detail =
      error instanceof Error
        ? ((error as NodeJS.ErrnoException).code ?? error.message)
        : String(error);
    throw new ConfigurationError(
      `Vocabulary cannot be read at ${displayPath(root, vocabularyPath)}: ${detail}`,
    );
  }
  const glossary = parseGlossary(glossaryText);
  const vocabulary = parseVocabulary(vocabularyText);
  return {
    root,
    policy,
    glossary,
    vocabulary,
    policyPath,
    glossaryPath,
    vocabularyPath,
    policyDigest: fileDigest(policyText),
    glossaryDigest: fileDigest(glossaryText),
    vocabularyDigest: fileDigest(vocabularyText),
  };
};
