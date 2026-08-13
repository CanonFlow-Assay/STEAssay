import { createHash } from "node:crypto";

export const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
};

export const canonicalJson = (value: unknown): string =>
  `${JSON.stringify(sortValue(value), null, 2)}\n`;

export const normalizePath = (path: string): string =>
  path.replaceAll("\\", "/");
