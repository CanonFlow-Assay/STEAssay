# Security policy

Report suspected security issues privately to the repository maintainers through GitHub security advisories. Do not include secrets, private documents, or protected vocabulary in public issues.

STEAssay analyzes local Markdown and runs only executable-and-argument vectors
explicitly configured by the project. `verify` launches them without a shell in
the target root. This prevents shell interpolation, but a repository-controlled
policy can still select programs and arguments available to the invoking user.
Treat `.steassay.json` and its referenced files as trusted process-execution
input and review policy changes as CI workflow changes. Do not run `verify` on
fork-controlled policy with repository secrets. STEAssay does not sandbox
required commands.
