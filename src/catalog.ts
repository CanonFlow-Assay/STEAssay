import { canonicalJson, sha256 } from "./canonical.js";
import { ruleCatalog } from "./rules.js";

export { findRule, ruleCatalog } from "./rules.js";
export type { RuleDefinition } from "./rules.js";

export const catalogDigest = sha256(canonicalJson(ruleCatalog));
