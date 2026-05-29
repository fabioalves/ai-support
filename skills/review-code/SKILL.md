---
name: review-code
description: Use when validating implementation code against a step-by-step plan (`plan.md`) and specs, typically before declaring a task or feature complete.
---

# review-code

## Overview
A quality gate that validates implemented code against the plan, specification, and industry best practices. It ensures code actually does what the plan claims and is maintainable.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use
- When the user inputs the slash command `/review-code <issueIdPattern>-<N>`
- When asked to perform a code review against a specific plan and spec

## Core Pattern
1. **Model Selection Prompt (CRITICAL FIRST STEP)**:
   - Before taking ANY action, ask the user: "Would you like to change the AI model to a more capable one for this review? (Yes/No)"
   - If the user says Yes, STOP execution immediately and instruct them to change the model using the settings before re-invoking the skill.
   - If the user says No, proceed to the next step.
2. **Locate `config.json`** in project root to find paths.
3. **Git Branch**: Run `git checkout <issueIdPattern>-<N>` to ensure you are on the correct branch.
4. **Verify Files** exist: `specs.md` and `plan.md`.
5. **Verification Gate (CRITICAL)**:
   - **REQUIRED SUB-SKILL**: You MUST invoke `superpowers:verification-before-completion` to run tests, build commands, and static analysis tools. You cannot review code by just reading it.
6. **Review Criteria**:
   - **Plan Alignment**: Does the codebase accurately reflect the completed items in `plan.md`?
   - **Verification Evidence**: Did all automated checks and tests pass?
   - **Code Quality**: Does the code follow industry best practices? Are there code smells (duplicated logic, bloated functions)? Are there missed edge cases?
7. **Generate Output**:
   - If issues exist: Write findings to `<specsDir>/<issueIdPattern>-<N>/review.md` (overwrite if exists).
   - If no issues: Do NOT create/edit any file. Output "All good" in chat.

## Bulletproofing & Rationalization Defense

Agents under time pressure naturally want to take shortcuts. The following rules are absolute:

| Excuse | Reality |
|--------|---------|
| "The code looks fine to the eye, I don't need to run verification tests." | Reading code is not verification. You MUST use the `superpowers:verification-before-completion` skill to gather hard evidence. |
| "I'm under time pressure, I'll just summarize the review in chat." | Chat is ephemeral. Other agents cannot read chat history easily. You MUST write `review.md` to the issue folder if issues exist. |
| "I will generate a formal artifact in my own brain/artifact directory." | Artifacts break localized context. `review.md` MUST be written exactly to `<specsDir>/<issueIdPattern>-<N>/review.md`. |
| "The code has minor issues, so I'll just fix it directly to save time." | You are reviewing the code. You MUST document the issues in `review.md` and let the implementer or user decide how to fix it. |

## Red Flags - STOP and Correct
- Skipping the `superpowers:verification-before-completion` step.
- Writing the review to the chat instead of `review.md` (when issues exist).
- Saving `review.md` to your central artifacts folder instead of the local issue folder.
- Modifying the source code directly during the review.

**All of these mean: Stop, discard changes, and start over following the Core Pattern.**
