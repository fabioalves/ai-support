---
name: implement
description: Use when implementing a technical specification for a specific GitHub backlog issue by its ID (e.g. KQM-22).
---

# implement

You are an expert Developer who translates architectural specifications into working code.
You execute; others design. A project manager owns design decisions and user communication.

**Violating the letter of the rules is violating the spirit of the rules.**

This skill is invoked with a specific issue ID parameter (e.g., `KQM-22` or `AI-14`).

## 📋 Required Pre-Execution Check (CRITICAL)

Before performing ANY codebase reads, file modifications, git checkouts, branch creations, command executions, or running tests:

1. **Locate and Parse `config.json`:**
   Locate `config.json` in the project's root folder (the parent of the repository root, e.g., `C:\projects\<project-name>\config.json`).
   * Extract `issueIdPattern` (e.g., `KQM` or `AI`), `specsDir` (e.g., `specs`), and `scriptsDir` (e.g., `scripts`).

2. **Identify the Issue ID:**
   Extract the issue number `<N>` from the passed parameter (e.g., for `KQM-22`, `<N>` is `22`). The localized folder is:
   `<specsDir>/<issueIdPattern>-<N>/`

3. **Check for plan.md existence:**
   Check if `<specsDir>/<issueIdPattern>-<N>/plan.md` exists in the repository.
   * **Prohibited Pre-Reads**: You may only check for the existence of `<specsDir>/<issueIdPattern>-<N>/plan.md` and read `specs.md` if necessary to locate it. You are strictly forbidden from checking out git branches, running codebase tests, or viewing implementation source files before this check is completed.

4. **Plan Missing Protocol (MUST HALT):**
   If the file `<specsDir>/<issueIdPattern>-<N>/plan.md` **does not exist**, you **MUST STOP IMMEDIATELY**.
   * You are strictly prohibited from performing any further steps, creating branches, checking out existing branches, running test suites, or writing code.
   * You **MUST** output a prompt asking the user:
     `Should I continue the execution only with the specs.md as source?`
   * You **MUST** halt and wait for the user's explicit reply before proceeding.
   * If the user approves, you may proceed. If the user rejects or provides a plan, follow that instruction instead.

---

## Superpowers Extensions

This skill integrates the `superpowers:*` skill suite as first-class extensions. Use them at the appropriate lifecycle phase:

| Phase | Skill | When to invoke |
| ----- | ----- | -------------- |
| **Plan** | `superpowers:writing-plans` | Spec is complex or multi-step; use to produce a bite-sized implementation plan before touching code |
| **Implement** | `superpowers:test-driven-development` | Any new feature or bug fix; write failing test first, then minimal code |
| **Execute plan** | `superpowers:executing-plans` | After a plan exists; executes tasks with checkpoints and review gates |
| **Debug** | `superpowers:systematic-debugging` | Any test failure, unexpected behaviour, or recurring blocker; always find root cause before fixing |
| **Verify** | `superpowers:verification-before-completion` | Before claiming work is done; run evidence commands and confirm output |
| **Review** | `superpowers:requesting-code-review` | After each major task or feature; dispatch reviewer subagent for fresh-eyes check |
| **Finish** | `superpowers:finishing-a-development-branch` | When all tasks pass; verify tests, detect environment, present merge/PR/discard options |

### Extension Activation Rules

- **Simple, self-contained spec** (single file, no tests required by spec): skip `writing-plans` and `executing-plans`; apply TDD + verification directly.
- **Complex / multi-step spec**: always invoke `writing-plans` first; announce `"I'm using the writing-plans skill"` at the start.
- **Any test failure during implementation**: suspend coding, invoke `systematic-debugging`, resolve root cause, then resume.
- **Before any completion claim**: invoke `verification-before-completion`; evidence before assertions, always.
- **After each task in a plan**: invoke `requesting-code-review`; fix Critical/Important issues before proceeding.
- **After all tasks complete**: invoke `finishing-a-development-branch`.

## GitHub Issue Tracking

When the spec file is a project specification with a linked GitHub issue, transition the issue to **In Progress** before making any changes.

### Transition Step (runs FIRST, after plan existence check passes and before reading any source files)

1. **Verify Current Status:**
   If the issue's GitHub status is already "In progress" (or if the transition script has already been executed successfully, or is logged as "In progress"), skip the status transition and proceed.

2. **Transition Status Command:**
   If not already "In progress", run the transition script from the repository root:
   ```powershell
   node <scriptsDir>/process-backlog.js in-progress <N>
   ```
   * Replace `<N>` with the detected issue number.
   * **CRITICAL**: You **MUST** run this command and wait for it to complete successfully before taking any other action unless the status is already "In progress".

## Development Branch Creation

Before making any code changes, if a spec file is passed as a parameter to this skill (e.g., `<specsDir>/<issueIdPattern>-14/specs.md`), you **MUST** create a new git branch for the implementation.

### Branch Naming Rule
- The branch name must be the name of the spec folder being developed (e.g., for `<specsDir>/<issueIdPattern>-14/specs.md`, the branch must be named `<issueIdPattern>-14`).
- Only perform this action if a spec is passed as a parameter.

### Command
```powershell
git checkout -b <BRANCH_NAME>
```

## Bulletproofing & Rationalization Defense

To resist shortcuts and rationalizations under pressure, refer to the following rules:

### Rationalization Table

| Excuse | Reality |
|--------|---------|
| "The branch `<issueIdPattern>-14` already exists and the code seems fully implemented, so I can bypass the plan check." | Bypassing the check is a violation of the letter of the rules. You must check for the existence of `plan.md` and ask the user BEFORE checking out the branch or verifying the code. |
| "I am under extreme time pressure, so I will just implement the spec without stopping to ask." | Quality and compliance are mandatory. Skipping the prompt when `plan.md` is missing leads to unaligned implementations. You MUST halt and ask. |
| "I'll do the git checkout and verify the tests first, and if they fail, I'll ask about the plan." | Any codebase read, git operation, or test execution before the plan check is strictly forbidden. The check must run first. |

### Red Flags - STOP and Correct

- Checking out git branches or running tests before checking if `plan.md` exists.
- Proceeding with implementation when `plan.md` is missing without prompting the user.
- Proceeding because "the work is already done on another branch".
