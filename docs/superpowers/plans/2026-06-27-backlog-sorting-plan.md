# Backlog Sorting Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the process-backlog script sorting fallback behavior to respect ascending ID/issue number order when priorities are identical.

**Architecture:** Modify the sorting comparator inside `listBacklog` to check if priority weights are equal, and if so, return the difference between the items' `number` properties.

**Tech Stack:** Node.js

## Global Constraints

- Must run on Node.js (zero-dependency).
- No external npm packages can be added to the project.

---

### Task 1: Update process-backlog.js Sorting Logic

**Files:**
- Modify: `scripts/process-backlog.js:254-260`

**Interfaces:**
- Consumes: `backlogItems` array of issues
- Produces: Sorted `backlogItems` array in place

- [ ] **Step 1: Write a temporary scratch test script**

Create `C:\Users\fabio\.gemini\antigravity-cli\brain\a4a4610e-87db-41b6-9021-fd3f796978eb/scratch/test-sort.js` with the following content:

```javascript
const priorityWeights = { 'P0': 3, 'P1': 2, 'P2': 1 };
const backlogItems = [
  { number: 3, priority: 'P1' },
  { number: 1, priority: 'P1' },
  { number: 2, priority: 'P0' },
  { number: 4, priority: 'P1' },
];
// Original sorting logic (no ID fallback)
backlogItems.sort((a, b) => {
  const weightA = priorityWeights[a.priority] || 0;
  const weightB = priorityWeights[b.priority] || 0;
  return weightB - weightA;
});
const expected = [2, 1, 3, 4];
const actual = backlogItems.map(item => item.number);
console.log('Actual Order:', actual);
console.assert(JSON.stringify(actual) === JSON.stringify(expected), `Fails because actual is not sorted by ID when priority is equal`);
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node C:\Users\fabio\.gemini\antigravity-cli\brain\a4a4610e-87db-41b6-9021-fd3f796978eb/scratch/test-sort.js
```
Expected: The assertion should fail or output a non-matching order (e.g., `[ 2, 3, 1, 4 ]` or similar where 1 is not before 3).

- [ ] **Step 3: Update sorting logic**

Modify `scripts/process-backlog.js` around lines 256-260:

```javascript
  backlogItems.sort((a, b) => {
    const weightA = priorityWeights[a.priority] || 0;
    const weightB = priorityWeights[b.priority] || 0;
    if (weightB !== weightA) {
      return weightB - weightA; // High priority first
    }
    return a.number - b.number; // Ascending order of issue number
  });
```

Also, update `C:\Users\fabio\.gemini\antigravity-cli\brain\a4a4610e-87db-41b6-9021-fd3f796978eb/scratch/test-sort.js` to use the new sorting logic:

```javascript
backlogItems.sort((a, b) => {
  const weightA = priorityWeights[a.priority] || 0;
  const weightB = priorityWeights[b.priority] || 0;
  if (weightB !== weightA) {
    return weightB - weightA;
  }
  return a.number - b.number;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node C:\Users\fabio\.gemini\antigravity-cli\brain\a4a4610e-87db-41b6-9021-fd3f796978eb/scratch/test-sort.js
```
Expected: PASS (no assertion error, actual order printed as `[ 2, 1, 3, 4 ]`).

- [ ] **Step 5: Commit changes**

Run:
```bash
git add scripts/process-backlog.js
git commit -m "feat: sort backlog items with same priority by issue number ascending"
```
