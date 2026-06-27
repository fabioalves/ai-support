# Backlog Sorting Design (Respect ID Order on Equal Priority)

## Overview
Currently, the backlog sync script sorts issues by priority. When multiple issues have the same priority level, their relative order is non-deterministic or depends on the GraphQL query output order. This design updates the sorting logic to respect the issue ID (number) order when the priority is the same.

## Target File
- [process-backlog.js](file:///C:/projects/ai-support/scripts/process-backlog.js)

## Proposed Changes
In the `listBacklog` function of [process-backlog.js](file:///C:/projects/ai-support/scripts/process-backlog.js), we will update the sorting callback:

```javascript
  // Define Priority ordering
  const priorityWeights = { 'P0': 3, 'P1': 2, 'P2': 1 };
  backlogItems.sort((a, b) => {
    const weightA = priorityWeights[a.priority] || 0;
    const weightB = priorityWeights[b.priority] || 0;
    if (weightB !== weightA) {
      return weightB - weightA; // High priority first
    }
    return a.number - b.number; // Ascending order of issue number
  });
```

## Verification
- We can verify the change by inspecting the code and dry-running/mocking the backlog array sorting if needed.
