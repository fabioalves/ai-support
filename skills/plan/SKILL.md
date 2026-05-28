---
name: plan
description: Use when the user requests "/plan <issueIdPattern>-<number>" or requests to create a technical implementation plan for a specific GitHub issue ID in the repository.
---

# plan

## Overview
Automates the process of generating a bite-sized, step-by-step implementation plan for a specific backlog issue by reading its specification and executing the `superpowers:writing-plans` workflow.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use
- When the user inputs the slash command `/plan <issueIdPattern>-<N>` (where `<N>` is the issue number).
- When a user asks to plan a specific GitHub issue in the format `<issueIdPattern>-<N>`.

### When NOT to Use
- Do not use for general coding, bug fixing, or manual verification. Use `implement` or other dedicated skills instead.
- Do not use if no specification file exists under `<specsDir>/<issueIdPattern>-<N>/specs.md`.

## Core Pattern
Locates `config.json` in project root → Identifies configurations → Locates specification file → Invokes `superpowers:writing-plans` → Saves result as `plan.md` in the specification's folder.

## Implementation Steps

When this skill is triggered with an issue ID (e.g., `KQM-12` or `AI-5`):

1. **Locate and Parse `config.json`:**
   Locate `config.json` in the project's root folder (e.g., `C:\projects\<project-name>\config.json`).
   * Extract `issueIdPattern` (e.g., `KQM` or `AI`), `specsDir` (e.g., `specs`), and `scriptsDir` (e.g., `scripts`).

2. **GitHub Issue Tracking (In Progress Transition):**
   When the spec file is a project specification with a linked GitHub issue, transition the issue to **In Progress** before executing the planning engine.
   * **Check Current Status**: If the issue's GitHub status is already "In progress" (or if the transition script has already been executed successfully, or is logged as "In progress"), skip the status transition and proceed.
   * **Transition Status Command**: If not already "In progress", run the transition script from the repository root:
     ```powershell
     node <scriptsDir>/process-backlog.js in-progress <N>
     ```
     Replace `<N>` with the detected issue number.

3. **Development Branch Creation:**
   Before executing the planning engine, you **MUST** create or switch to a dedicated git branch for the issue according to the rules under **Development Branch Creation** below.

4. **Locate the Specification File:**
   Locate the specification file corresponding to the issue. The path is always:
   `<specsDir>/<issueIdPattern>-<N>/specs.md` (relative to the repository root).

5. **Execute the Planning Engine:**
   Use the `superpowers:writing-plans` sub-skill on `<specsDir>/<issueIdPattern>-<N>/specs.md` to design a comprehensive, step-by-step technical implementation plan.
   * **Required Sub-Skill**: You MUST understand and execute the `superpowers:writing-plans` workflow to produce a structured, checkable task-by-task plan.

6. **Save the Resulting Plan:**
   Save the generated plan as a new markdown file named `plan.md` in the exact same folder as the `specs.md` file:
   `<specsDir>/<issueIdPattern>-<N>/plan.md`
   
   **No exceptions:**
   - Do NOT save the plan in a centralized plans folder.
   - Do NOT save the plan in the workspace root or parent directories.
   - Do NOT just print the plan in the chat. It MUST be written to `<specsDir>/<issueIdPattern>-<N>/plan.md`.

7. **Verify the Output:**
   Ensure the generated file exists and contains the complete, bite-sized tasks with checkboxes (`- [ ]`) as required by the planning guidelines.

## Development Branch Creation

Before executing the planning engine or making any file changes, if an issue ID is passed as a parameter to this skill (e.g., `KQM-29`), you **MUST** create or switch to a dedicated git branch for the planning and implementation.

### Branch Naming Rule
- The branch name must be the issue ID being planned (e.g., for `KQM-29`, the branch must be named `KQM-29`).
- Only perform this action if an issue ID is passed as a parameter.

### Commands
If the branch already exists:
```powershell
git checkout <BRANCH_NAME>
```
Otherwise, create and switch to it:
```powershell
git checkout -b <BRANCH_NAME>
```

## Bulletproofing & Rationalization Defense

To resist shortcuts and rationalizations under pressure, refer to the following rules:

### Rationalization Table

| Excuse | Reality |
|--------|---------|
| "The senior architect needs it right now, so I'll just print it in chat to save time." | Printing in chat does not persist the plan in the repository for other agents. Write the file to the exact path. |
| "A centralized plans directory is cleaner, so I will write it to `<specsDir>/plans/<issueIdPattern>-<N>.md`." | Centralized plans break localized context for developers. The plan MUST be in the same directory as the spec (`<specsDir>/<issueIdPattern>-<N>/plan.md`). |
| "This is a simple spec, so a quick custom summary is enough instead of `superpowers:writing-plans`." | Simple specs still have subtle edge cases. Using `superpowers:writing-plans` is mandatory to guarantee robust checklists. |
| "The branch `<issueIdPattern>-<N>` already exists, or I am just writing a plan, so I don't need to create/switch to the feature branch." | Creating or switching to the dedicated branch before generating the plan is mandatory to ensure all planning artifacts are isolated to the correct branch. You MUST run the git commands. |

### Red Flags - STOP and Correct

- Printing the plan in the chat instead of writing to a file.
- Saving `plan.md` in the wrong folder (e.g. workspace root, parent folders).
- Not calling or simulating the `superpowers:writing-plans` checklist format.
- Creating the plan before locating and thoroughly reading `specs.md`.
- Writing the plan (`plan.md`) without first checking out or creating the dedicated git branch.
