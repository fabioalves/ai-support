---
name: review-plan
description: Use when validating an implementation plan (`plan.md`) against its technical specification (`specs.md`) to ensure completeness and correctness before coding begins.
---

# review-plan

## Overview
A quality gate that validates an implementation plan against its technical specification. It prevents incomplete, overly broad, or untestable plans from reaching the implementation phase.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use
- When the user inputs the slash command `/review-plan <issueIdPattern>-<N>`
- When asked to review a plan against a spec

## Core Pattern
1. **Model Selection Prompt (CRITICAL FIRST STEP)**:
   - Before taking ANY action, ask the user: "Would you like to change the AI model to a more capable one for this review? (Yes/No)"
   - If the user says Yes, STOP execution immediately and instruct them to change the model using the settings before re-invoking the skill.
   - If the user says No, proceed to the next step.
2. **Locate `config.json`** in project root to find `specsDir` and `issueIdPattern`.
3. **Verify Files** exist: `<specsDir>/<issueIdPattern>-<N>/specs.md` and `plan.md`. Halt if missing.
4. **Review Criteria**:
   - **Completeness**: Are all requirements and edge cases from `specs.md` addressed?
   - **Granularity**: Are tasks bite-sized and logically sequenced?
   - **Formatting**: Do tasks use standard checkboxes (`- [ ]`)?
   - **Verification**: Are there tasks to test/verify the implementation?
5. **Generate Output**:
   - If issues exist: Write findings to `<specsDir>/<issueIdPattern>-<N>/review.md` (overwrite if exists).
   - If no issues: Do NOT create/edit any file. Output "All good" in chat.

## Bulletproofing & Rationalization Defense

Agents under time pressure naturally want to take shortcuts. The following rules are absolute:

| Excuse | Reality |
|--------|---------|
| "I'm under extreme time pressure, I'll just summarize the review in chat." | Chat is ephemeral. Other agents cannot read chat history easily. You MUST write `review.md` to the issue folder if issues exist. |
| "I will generate a formal artifact in my own brain/artifact directory." | Artifacts break localized context. `review.md` MUST be written exactly to `<specsDir>/<issueIdPattern>-<N>/review.md`. |
| "The plan has issues, so I'll just fix `plan.md` directly to save time." | You are a reviewer, not the planner. You MUST document the issues in `review.md` and let the planner or user decide how to fix it. |

## Red Flags - STOP and Correct
- Writing the review to the chat instead of `review.md` (when issues exist).
- Saving `review.md` to your central artifacts folder instead of the local issue folder.
- Modifying `plan.md` directly.

**All of these mean: Delete the output and start over following the Core Pattern.**
