# M3 — required-command boundary

M3 replaces shell command strings with policy version 2 executable-and-argument
arrays. It is intentionally limited to the `requiredCommands` trust boundary:
no Markdown analyzer rule, Playground behavior, package metadata, release, or
CI command changes are part of this slice.

## Policy schema and migration

Each item in `requiredCommands` is a non-empty array of non-empty strings:

```json
{
  "version": 2,
  "requiredCommands": [
    ["npm", "run", "typecheck"],
    ["npm", "test"]
  ]
}
```

The first item is the executable and later items are literal arguments. There
is no shell parser and no escape convention. If a project previously used a
version 1 string such as `"npm run test"`, migrate it to
`["npm", "run", "test"]`. A compound string such as
`"npm run test && npm run lint"` must split into separate vectors where that
preserves intent. Shell composition,
redirection, command substitution, and environment assignments require a
deliberate project-owned executable or script; they are not represented in
policy.

The executable must be directly launchable on the host platform. In particular,
a platform batch wrapper that requires a command interpreter is not implicitly
supported; it becomes `Unavailable` rather than causing STEAssay to enable a
shell. Projects should use a directly executable program or an explicit
project-owned launcher.

Version 1 policies are rejected as `Inconclusive`, with `authoritative: false`.
They are never executed. This makes migration explicit instead of retaining an
invisible shell fallback.

## Execution and evidence

The launcher calls the configured executable with its array of arguments and
explicitly disables shell execution. Receipts use schema version 2 and bind the
exact `executable` and ordered `arguments` for each command, together with
status, exit code, and output digest. `scan` keeps configured commands as
`NotRun`; `verify` is authoritative only when complete scope is observed and
every required command passes.

M3 tests use a shell-control payload as a literal argument and prove that it is
recorded as argv while its attempted side effect never occurs. They also prove
that legacy string policies and malformed arrays are non-authoritative.

## Remaining trust boundary

Direct process spawning removes shell interpolation. It does not make policy
safe to accept from an untrusted source: a policy can still name an executable
and arguments that perform harmful work. Review `.steassay.json` changes as CI
workflow changes. Do not run `verify` on fork-controlled policy with repository
secrets. The M3 workflow and code add no secrets, shell fallback, or sandboxing.

## Compatibility and release impact

This changes the policy and receipt schemas. No npm release is made by M3. Any
future release carrying it must communicate the version 1-to-2 migration and
receipt schema version 2 as a compatibility change.
