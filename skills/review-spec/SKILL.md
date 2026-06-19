---
name: review-spec
description: Use when reviewing a technical specification for a backlog issue to verify its completeness and quality before starting implementation planning.
---

# review-spec

## Overview
A quality gate that validates a technical specification for completeness and correctness. It prevents implementation on top of poor, incomplete, or ambiguous specifications.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use
- When the user asks to review a specification for a specific issue (e.g. `/review-spec <issueIdPattern>-<N>`).
- When checking if a spec file is complete and ready for planning or coding.

### When NOT to Use
- Do not use for reviewing implementation code or plans. Use `review-code` or `review-plan` instead.
- Do not use if the specification file (`specs.md`) does not exist.

## Core Pattern
1. **Model Selection Prompt (CRITICAL FIRST STEP)**:
   - Before taking ANY action, ask the user: "Would you like to change the AI model to a more capable one for this review? (Yes/No)"
   - If the user says Yes, STOP execution immediately and instruct them to change the model using the settings before re-invoking the skill.
2. **Locate & Load Spec**: Locate `config.json` in the project root to find `specsDir` and `issueIdPattern`. Load `<specsDir>/<issueIdPattern>-<N>/specs.md`. Halt if missing.
3. **Analyze Completeness**: Review the spec across 4 dimensions:
   - **Overview**: Clarity of goals and business logic.
   - **Context**: Codebase relevance and repository-relative paths (no absolute or `file://` paths).
   - **Implementation Plan**: Tasks for frontend/backend.
   - **Verification Plan**: Clear automated/manual test checklists.
4. **Draft & Save Review**: Save review findings as `<specsDir>/<issueIdPattern>-<N>/review-specs.md`.
5. **Interactive Guided Walkthrough**:
   - Present the review section-by-section. Do NOT output the entire review at once.
   - **CRITICAL**: Print the FULL content of the current section's review before asking the user for their choice.
   - For each section, prompt the user with:
     - **Accept**: Proceed to the next section.
     - **Adjust**: Take user's feedback, update the review/spec, save to file, re-display, and prompt again.
     - **Cancel**: Stop the walkthrough. Mark all remaining sections as "Pending Acceptance" (e.g. adding "(Pending Acceptance)" to their headings) in `review-specs.md`.

## Bulletproofing & Rationalization Defense

| Excuse | Reality |
|--------|---------|
| "I'm in a rush, I'll print the review directly in the chat instead of writing a file." | Chat is ephemeral. The review MUST be saved to `<specsDir>/<issueIdPattern>-<N>/review-specs.md`. |
| "I'll ask for approval of the whole review at once." | You MUST present the review section-by-section to ensure the user reads and validates each part. |
| "I'll ask if they accept without showing the text." | You MUST print the full section text before prompting for their selection. |

### Red Flags - STOP and Correct
- Printing the entire review at once or skipping the walkthrough.
- Saving `review-specs.md` in the wrong location or not writing the file.
- Bypassing the model selection prompt.
- Linking files using absolute paths or `file://` URIs instead of repository-relative paths.
