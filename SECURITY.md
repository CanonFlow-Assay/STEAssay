# Security policy

Report suspected security issues privately to the repository maintainers through GitHub security advisories. Do not include secrets, private documents, or protected vocabulary in public issues.

STEAssay analyzes local Markdown and runs only commands explicitly configured by the project. `verify` passes each `requiredCommands` string to the platform shell in the target root. A repository-controlled policy can therefore execute arbitrary shell syntax and programs available to that user. Treat the policy and its referenced files as trusted executable input, and review them before running `verify`. STEAssay does not sandbox required commands.
