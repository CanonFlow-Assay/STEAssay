import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { relative, resolve } from "node:path";
import fg from "fast-glob";
import { normalizePath } from "./canonical.js";
import type { Policy, ScopeObservation } from "./model.js";

export class ScopeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

export interface ScopedFile {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly content: string;
}

const toRelative = (root: string, path: string): string =>
  normalizePath(relative(root, path));

export const resolveTarget = async (
  target: string,
): Promise<{ readonly root: string; readonly fileTarget?: string }> => {
  const resolved = resolve(target);
  try {
    const info = await stat(resolved);
    return info.isDirectory()
      ? { root: resolved }
      : { root: resolve(resolved, ".."), fileTarget: resolved };
  } catch {
    throw new ScopeError(`Target does not exist: ${resolved}`);
  }
};

export const observeScope = async (
  root: string,
  policy: Policy,
  fileTarget?: string,
): Promise<{
  readonly scope: ScopeObservation;
  readonly files: readonly ScopedFile[];
}> => {
  const onlyFiles =
    fileTarget === undefined ? undefined : [toRelative(root, fileTarget)];
  const includeMatches = await Promise.all(
    policy.includeGlobs.map(async (glob) => ({
      glob,
      paths: await fg(glob, {
        cwd: root,
        onlyFiles: true,
        unique: true,
        dot: false,
        followSymbolicLinks: false,
      }),
    })),
  );
  const excludedMatches = await Promise.all(
    policy.excludedGlobs.map(async (glob) =>
      fg(glob, {
        cwd: root,
        onlyFiles: true,
        unique: true,
        dot: false,
        followSymbolicLinks: false,
      }),
    ),
  );
  const excluded = new Set(excludedMatches.flat().map(normalizePath));
  const include = new Set(
    includeMatches.flatMap((entry) => entry.paths).map(normalizePath),
  );
  const restricted =
    onlyFiles === undefined
      ? [...include]
      : [...include].filter((path) => onlyFiles.includes(path));
  const selected = restricted
    .filter((path) => !excluded.has(path))
    .sort((a, b) => a.localeCompare(b));
  const unloadedPaths: string[] = selected.filter(
    (path) => !path.toLowerCase().endsWith(".md"),
  );
  const candidates = selected.filter((path) =>
    path.toLowerCase().endsWith(".md"),
  );
  const files: ScopedFile[] = [];
  for (const path of candidates) {
    const absolutePath = resolve(root, path);
    try {
      await access(absolutePath, constants.R_OK);
      files.push({
        absolutePath,
        relativePath: normalizePath(path),
        content: await readFile(absolutePath, "utf8"),
      });
    } catch {
      unloadedPaths.push(normalizePath(path));
    }
  }
  const unmatchedGlobs = includeMatches
    .filter((entry) => entry.paths.length === 0)
    .map((entry) => entry.glob)
    .sort();
  const scope: ScopeObservation = {
    scannedPaths: files.map((file) => file.relativePath),
    excludedPaths: [...excluded].sort((a, b) => a.localeCompare(b)),
    unmatchedGlobs,
    unloadedPaths: unloadedPaths.sort((a, b) => a.localeCompare(b)),
    complete: unmatchedGlobs.length === 0 && unloadedPaths.length === 0,
  };
  return { scope, files };
};
