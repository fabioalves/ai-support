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

1. **Execute Pre-Implement Script:**
   Run the `pre-implement.ps1` script to automate configuration parsing, branch management, issue status transitions, and verifying the existence of the `plan.md` file.
   ```powershell
   & "$env:USERPROFILE\.gemini\antigravity-cli\skills\implement\scripts\pre-implement.ps1" -IssueId <issue-id>
   ```
   * **CRITICAL:** If the script errors due to a missing `plan.md`, you **MUST STOP IMMEDIATELY** and output a prompt asking the user: `Should I continue the execution only with the specs.md as source?` Wait for the user's explicit reply before proceeding.

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


## Bulletproofing & Rationalization Defense

To resist shortcuts and rationalizations under pressure, refer to the following rules:

### Rationalization Table

| Excuse | Reality |
|--------|---------|
| "The branch `<issueIdPattern>-14` already exists and the code seems fully implemented, so I can bypass the plan check." | Bypassing the check is a violation of the letter of the rules. You must check for the existence of `plan.md` and ask the user BEFORE checking out the branch or verifying the code. |
| "I am under extreme time pressure, so I will just implement the spec without stopping to ask." | Quality and compliance are mandatory. Skipping the prompt when `plan.md` is missing leads to unaligned implementations. You MUST halt and ask. |
| "I'll do the git checkout and verify the tests first, and if they fail, I'll ask about the plan." | Any codebase read, git operation, or test execution before the plan check is strictly forbidden. The check must run first. |
| "I am under tight time pressure, so I will skip checking for LEARNING.md or bypass its constraints." | Reading and respecting `LEARNING.md` is a critical, mandatory step. Skipping it leads to repeating past mistakes. You MUST check for it and adhere to it. |

### Red Flags - STOP and Correct

- Checking out git branches or running tests before checking if `plan.md` exists.
- Proceeding with implementation when `plan.md` is missing without prompting the user.
- Proceeding because "the work is already done on another branch".
- Proceeding with implementation without checking if a `LEARNING.md` file exists in the repository root and applying its conventions.
