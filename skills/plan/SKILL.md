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

1. **Execute Pre-Plan Script:**
   Run the `pre-plan.ps1` script to automate configuration parsing, branch management, issue status transitions, and locate the required files.
   ```powershell
   & "$env:USERPROFILE\.gemini\antigravity-cli\skills\plan\scripts\pre-plan.ps1" -IssueId <issue-id>
   ```
   * **Note:** This script will output the location of the `specs.md` file and check for `LEARNING.md`.

2. **Execute the Planning Engine:**
   Use the `superpowers:writing-plans` sub-skill on `<specsDir>/<issueIdPattern>-<N>/specs.md` to design a comprehensive, step-by-step technical implementation plan.
   * **Required Sub-Skill**: You MUST understand and execute the `superpowers:writing-plans` workflow to produce a structured, checkable task-by-task plan.

3. **Save the Resulting Plan:**
   Save the generated plan as a new markdown file named `plan.md` in the exact same folder as the `specs.md` file:
   `<specsDir>/<issueIdPattern>-<N>/plan.md`
   
   **No exceptions:**
   - Do NOT save the plan in a centralized plans folder.
   - Do NOT save the plan in the workspace root or parent directories.
   - Do NOT just print the plan in the chat. It MUST be written to `<specsDir>/<issueIdPattern>-<N>/plan.md`.

4. **Interactive Guided Walkthrough:**
   After generating and saving the initial plan, you MUST present the plan to the user as a guided walkthrough, section by section.
   * Do NOT output the entire plan at once in the chat.
   * **CRITICAL**: You MUST explicitly print the FULL content of the current section in the console/chat BEFORE asking the user for their choice. Do NOT just ask if they accept without showing them the text.
   * After displaying the section's content, ask the user to respond with one of the following options:
     1. **Accept**: Proceed to the next section.
     2. **Adjust**: The user provides adjustments. You must update the section (and `plan.md`), then ask for acceptance again.
     3. **Cancel**: Stop the walkthrough.
   * Continue to the next section only when the current one is accepted.
   * If the user chooses **Cancel**, you MUST update the `plan.md` file to explicitly mark all sections that were not shown and accepted as **Pending Acceptance** (e.g., adding a "(Pending Acceptance)" note to their headings).

5. **Verify the Output:**
   Ensure the generated file exists, contains the complete, bite-sized tasks with checkboxes (`- [ ]`) as required by the planning guidelines, and reflects any adjustments made during the walkthrough.


## Bulletproofing & Rationalization Defense

To resist shortcuts and rationalizations under pressure, refer to the following rules:

### Rationalization Table

| Excuse | Reality |
|--------|---------|
| "The senior architect needs it right now, so I'll just print it in chat to save time." | Printing in chat does not persist the plan in the repository for other agents. Write the file to the exact path. |
| "A centralized plans directory is cleaner, so I will write it to `<specsDir>/plans/<issueIdPattern>-<N>.md`." | Centralized plans break localized context for developers. The plan MUST be in the same directory as the spec (`<specsDir>/<issueIdPattern>-<N>/plan.md`). |
| "This is a simple spec, so a quick custom summary is enough instead of `superpowers:writing-plans`." | Simple specs still have subtle edge cases. Using `superpowers:writing-plans` is mandatory to guarantee robust checklists. |
| "The branch `<issueIdPattern>-<N>` already exists, or I am just writing a plan, so I don't need to create/switch to the feature branch." | Creating or switching to the dedicated branch before generating the plan is mandatory to ensure all planning artifacts are isolated to the correct branch. You MUST run the git commands. |
| "I am under tight time pressure, so I will skip checking the repository's LEARNING.md or hallucinate its verification." | Checking `LEARNING.md` is a mandatory step that prevents repeating past mistakes and violating project-wide conventions. You MUST check and read it if it exists. |
| "The user can read the file, so I will just ask for approval without printing the section." | The user needs to see the section in the console to review it easily. You MUST print the full section text before asking for approval. |

### Red Flags - STOP and Correct

- Printing the plan in the chat instead of writing to a file.
- Saving `plan.md` in the wrong folder (e.g. workspace root, parent folders).
- Not calling or simulating the `superpowers:writing-plans` checklist format.
- Creating the plan before locating and thoroughly reading `specs.md`.
- Writing the plan (`plan.md`) without first checking out or creating the dedicated git branch.
- Designing the plan without explicitly checking if a `LEARNING.md` file exists in the repository root and applying its conventions.
- Skipping the interactive section-by-section walkthrough or showing the entire plan at once.
- Asking for section acceptance without explicitly showing the section's full content in the console first.
