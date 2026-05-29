# Review Skills Design (review-plan & review-code)

## Overview
Two new complementary skills designed to review planning artifacts and implemented code against technical specifications. These serve as quality gates during the development lifecycle.

## 1. `review-plan` Skill

**Purpose:** Validates the implementation plan (`plan.md`) against the requirements in the technical specification (`specs.md`).

**Trigger:** `/review-plan <issueIdPattern>-<N>`

**Execution Flow:**
1. **Context Loading:** 
   - Parse `config.json` at the workspace root to retrieve `specsDir` and `issueIdPattern`.
   - Verify that `<specsDir>/<issueIdPattern>-<N>/specs.md` exists.
   - Verify that `<specsDir>/<issueIdPattern>-<N>/plan.md` exists.
   - Halt execution if either file is missing.
2. **Review Criteria:**
   - **Completeness:** Are all requirements and edge cases from `specs.md` addressed in the plan?
   - **Granularity:** Are the tasks bite-sized and logically sequenced?
   - **Formatting:** Do tasks use the standard `- [ ]` checkbox format?
   - **Verification:** Does the plan include tasks to test/verify the implementation?
3. **Output:**
   - If issues or gaps are found, generate or overwrite `<specsDir>/<issueIdPattern>-<N>/review.md` detailing the required fixes.
   - If no issues are found, do **not** create the file. Instead, output "All good" in the chat.

## 2. `review-code` Skill

**Purpose:** Validates the implementation against the plan, specs, and industry standards.

**Trigger:** `/review-code <issueIdPattern>-<N>`

**Execution Flow:**
1. **Context Loading:**
   - Parse `config.json` at the workspace root to retrieve paths.
   - Run `git checkout <issueIdPattern>-<N>` to ensure the agent is reviewing the correct branch.
   - Verify `specs.md` and `plan.md` exist.
2. **Verification Gate:**
   - The skill **MUST** invoke `superpowers:verification-before-completion` to run tests, build commands, and static analysis tools.
3. **Review Criteria:**
   - **Plan Alignment:** Do the codebase changes accurately reflect the completed items in `plan.md`?
   - **Verification Evidence:** Did all automated checks and tests pass?
   - **Code Quality & Maintainability:**
     - Does the code follow industry best practices?
     - Are there code smells (e.g., duplicated logic, bloated classes/functions)?
     - Are there maintainability issues or architectural boundary violations?
     - Are there missed edge cases or obvious bugs?
4. **Output:**
   - If bugs, test failures, code smells, or unaligned code are found, write the detailed findings to `<specsDir>/<issueIdPattern>-<N>/review.md` (overwriting previous reviews).
   - If the code is fully verified and perfectly aligned, do **not** create the file. Output "All good" in the chat.

## Anti-Patterns & Constraints
- **Centralized Logs:** The `review.md` file MUST NOT be stored centrally. It must live in the specific issue's directory.
- **Skipping Verification:** `review-code` must never rely purely on reading source code; it must execute the verification skill to gather hard evidence.
