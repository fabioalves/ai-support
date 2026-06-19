---
name: create-specs
description: "Use this skill to refine a single GitHub backlog issue by its ID (e.g. KQM-12). This skill researches the codebase, generates a comprehensive technical specification, links it on GitHub, transitions the issue to 'Ready', and commits/pushes the spec to the repository."
---

# Create Specs Skill

You are an expert Architect who transforms a single backlog issue into an unambiguous, executable technical specification.
You design; others implement. All architectural and business decisions happen during planning, BEFORE code is written.

This skill automates the process of researching codebase context, generating a thorough technical specification for a **single specific issue**, promoting that issue to the **Ready** column on GitHub, and committing the spec.

## 📋 Prerequisites & Setup

1. **GitHub Personal Access Token (PAT):**
   Ensure your environment has a valid GitHub PAT with `repo` and `project` scopes. The token must be set in the environment variable specified in `specs/batch-config.json` (defaults to `GITHUB_PAT`).
   * **PowerShell:** `$env:GITHUB_PAT="your_token_here"`
   * **Bash/macOS:** `export GITHUB_PAT="your_token_here"`

2. **Node.js Environment:**
   You must have Node.js (v18+) installed to run the backend automation script `scripts/process-backlog.js`.

---

## 🔗 Relative Paths in Spec Documents

Spec files are committed to the repository and published on GitHub. All file references in specs **must use repository-relative paths**, not absolute local paths.

- ✅ **Correct:** `src/backend/KQM.API/Controllers/QueueController.cs`
- ✅ **Correct (markdown link):** [`QueueController.cs`](src/backend/KQM.API/Controllers/QueueController.cs)
- ❌ **Wrong:** `C:/projects/karaokequeuemanager/karaokequeuemanager/src/backend/...`
- ❌ **Wrong:** `file:///C:/projects/...`

When writing markdown links for files, always use the path **relative to the repository root** (i.e. the directory containing `README.md`). Never use `file://` URIs or machine-specific absolute paths.

---

## 🔄 Single Issue Refinement Workflow

When invoked with an issue ID (e.g., `KQM-12`), follow these steps meticulously:

### Step 1: Retrieve the Issue Details
To understand the requirements of the requested issue (e.g. #12):
1. Run the fetch command to download the current backlog items:
   ```bash
   node scripts/process-backlog.js fetch
   ```
2. Read the generated `specs/active-batch.json` file to find the issue matching the ID (e.g. issue number `12`). Extract its title and description.
3. If not found in `specs/active-batch.json`, you can run `node scripts/process-backlog.js list` to search all open backlog items.

### Step 2: Codebase Research & Context Gathering
For the specified issue:
1. **Search the Codebase:** Look up files, endpoints, components, or database structures relevant to the issue's requirements.
2. **Determine Technical Scope:**
   - What new backend services or endpoints (C#/.NET Aspire) are needed?
   - What UI component modifications or new screens (React/TypeScript/Vite) must be introduced?
   - Do any database schemas or configuration files require modification?

### Step 3: Write the Technical Specification
Draft a highly detailed technical specification document for the issue. Save this file temporarily at a path like `specs/temp-spec-KQM-<issue-number>.md`.

Use the standard specification template provided below in the **Specification Template** section. Ensure all placeholders are expanded with actual, concrete paths and designs tailored to the Karaoke Queue Manager codebase.

### Step 4: Finalize the Specification
Execute the `finalize-spec.ps1` script to automate submitting the issue, committing the files to Git, and cleaning up temporary files.
```powershell
& "$env:USERPROFILE\.gemini\antigravity-cli\skills\create-specs\scripts\finalize-spec.ps1" -IssueNumber <issue-number> -IssueId <issue-id> -TempSpecPath specs/temp-spec-KQM-<issue-number>.md
```

---

## 📝 Specification Template

Use this template structure for the spec file. Replace brackets with precise codebase elements and configurations.

```markdown
# Specification: [Issue Title] (KQM-[Issue Number])

## 1. Overview
[A concise summary of the functional requirement, user stories, and why this is being implemented.]

## 2. Codebase Context
- **Relevant Files:** *(use repository-relative paths only — no `file://` URIs or absolute machine paths)*
  - [`HostView.tsx`](src/frontend/src/components/HostView.tsx) - [Description of current behavior and why it needs changes]
  - [`QueueController.cs`](src/backend/KQM.API/Controllers/QueueController.cs) - [Description of backend integration]
- **API Endpoints Affected:**
  - `[HTTP METHOD] /api/v1/...` (Include request/response models if applicable)

## 3. Technical Implementation Plan
Provide a concrete step-by-step plan for implementing the feature.

### Backend (.NET / Aspire)
- [ ] [Task 1: Describe backend API changes or database updates]
- [ ] [Task 2: Describe new configurations or integrations]

### Frontend (React / Vite)
- [ ] [Task 1: Describe component and state changes]
- [ ] [Task 2: Details of CSS and responsive styling updates]

## 4. Verification Plan
Outline the manual and automated steps needed to verify correctness.

### Automated Tests
- Run unit tests: `dotnet test`
- Build verification: `npm run build` inside `src/frontend`

### Manual Verification
- [ ] [Step 1: Steps to verify functionality in local development server]
- [ ] [Step 2: Verify responsive behavior on different device viewports]
```
