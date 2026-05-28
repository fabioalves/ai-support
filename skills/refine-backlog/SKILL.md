---
name: refine-backlog
description: Use this skill to automate GitHub project backlog synchronization and spec refinement across any project workspace.
---

# Backlog Refinement Skill

You are an expert Architect who transforms ambiguous requests into unambiguous executable plans.
You design; others implement. All business decisions happen during planning, BEFORE code is written.

This skill automates the process of synchronizing a project's backlog, researching codebase context, generating thorough technical specifications, and promoting refined issues on GitHub.

## 📋 Required Pre-Execution Check

Before starting execution, you MUST:
1. **Locate and Parse `config.json`:**
   Locate `config.json` in the project's root folder (e.g., `C:\projects\<project-name>\config.json`).
   * Extract `issueIdPattern` (e.g., `KQM` or `AI`), `specsDir` (e.g., `specs`), and `scriptsDir` (e.g., `scripts`).

2. **GitHub Personal Access Token (PAT):**
   Ensure your environment has a valid GitHub PAT set in the variable specified in `config.json` (defaults to `GITHUB_PAT`).

---

## 🔗 Relative Paths in Spec Documents

Spec files are committed to the repository and published on GitHub. All file references in specs **must use repository-relative paths**, not absolute local paths.
* ✅ **Correct:** `src/backend/KQM.API/Controllers/QueueController.cs`
* ❌ **Wrong:** `C:/projects/karaokequeuemanager/karaokequeuemanager/src/backend/...`
* ❌ **Wrong:** `file:///C:/projects/...`

---

## 🔄 Standard Refinement Workflow

Follow these steps meticulously to refine backlog items:

### Step 1: Fetch Backlog Items
Run the fetch command to download the next priority batch of backlog issues into `<specsDir>/active-batch.json`:
```bash
node <scriptsDir>/process-backlog.js fetch
```
Read the generated `<specsDir>/active-batch.json` to inspect the issues assigned to the current active batch.

### Step 2: Codebase Research & Context Gathering
For each issue in `<specsDir>/active-batch.json`:
1. **Check Priority:** Verify that the issue has a priority explicitly defined. If the issue lacks a priority, skip it entirely and do not create a spec.
2. **Search the Codebase:** Look up files, endpoints, components, or database structures relevant to the issue's requirements.

### Step 3: Write the Technical Specification
Draft a highly detailed technical specification document for the issue. Save this file temporarily at a path like:
`<specsDir>/temp-spec-<issueIdPattern>-<issue-number>.md`

Use a standard specification template detailing:
- 1. Overview
- 2. Codebase Context (relevant files using repository-relative paths only)
- 3. Technical Implementation Plan (step-by-step backend, frontend, database)
- 4. Verification Plan (automated unit tests and manual steps)

### Step 4: Submit & Transition the Issue
Promote the refined issue by running the update command. This command copies your spec as `specs.md` into the folder `<specsDir>/<issueIdPattern>-<issue-number>/`, comments on GitHub, and transitions the Project Board item to **Ready**:
```bash
node <scriptsDir>/process-backlog.js update <issue-number> --spec-file `<specsDir>/temp-spec-<issueIdPattern>-<issue-number>.md`
```

### Step 5: Commit and Push the Specs
Commit and push the newly generated specs to the repository:
```bash
git add <specsDir>/
git commit -m "docs: add specs for <issueIdPattern>-<issue-number>"
git push
```

### Step 6: Clean Up
Remove any temporary files created (e.g. `<specsDir>/temp-spec-<issueIdPattern>-<issue-number>.md`).

---

## 🔀 Splitting Issues (Optional)

If a backlog item is too large, you can split it into sub-tasks.
Create a temporary JSON file (e.g. `<specsDir>/split-<issueIdPattern>-<issue-number>.json`):
```json
[
  {
    "title": "Sub-task title",
    "description": "Sub-task description",
    "specFile": "<specsDir>/temp-sub-task-1.md"
  }
]
```

Pass this file to the update script using the `--split-issues` parameter:
```bash
node <scriptsDir>/process-backlog.js update <issue-number> --spec-file <specsDir>/temp-spec-<issueIdPattern>-<issue-number>.md --split-issues <specsDir>/split-<issueIdPattern>-<issue-number>.json
```
