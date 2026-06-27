#!/usr/bin/env bash
# pre-plan.sh
# Bash version of pre-plan.ps1 for cross-platform compatibility.

set -e

# Parse arguments
IssueId=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--issue-id)
            IssueId="$2"
            shift 2
            ;;
        *)
            if [ -z "$IssueId" ]; then
                IssueId="$1"
                shift
            else
                echo "Unknown argument: $1" >&2
                exit 1
            fi
            ;;
    esac
done

if [ -z "$IssueId" ]; then
    echo "Usage: $0 <issue-id> or $0 -i <issue-id>" >&2
    exit 1
fi

configPath="config.json"
if [ ! -f "$configPath" ]; then
    echo "Error: config.json not found in the current directory." >&2
    exit 1
fi

# Parse config.json using node
issueIdPattern=$(node -e "console.log(require('./config.json').issueIdPattern)")
specsDir=$(node -e "console.log(require('./config.json').specsDir)")
scriptsDir=$(node -e "console.log(require('./config.json').scriptsDir || 'scripts')")

if [[ "$IssueId" =~ ^$issueIdPattern-([0-9]+)$ ]]; then
    N="${BASH_REMATCH[1]}"
else
    echo "Error: IssueId '$IssueId' does not match pattern '$issueIdPattern-N'." >&2
    exit 1
fi

# Check for Learnings
if [ -f "LEARNING.md" ]; then
    echo "[REQUIRED] LEARNING.md found. You MUST read its contents and respect its practices."
fi

# Branch Management
currentBranch=$(git branch --show-current)
if [ "$currentBranch" != "$IssueId" ]; then
    if git rev-parse --verify --quiet "$IssueId" >/dev/null 2>&1; then
        git checkout "$IssueId"
    else
        git checkout -b "$IssueId"
    fi
fi

# Transition Issue Status
if [ -f "$scriptsDir/process-backlog.js" ]; then
    node "$scriptsDir/process-backlog.js" in-progress "$N"
fi

# Locate Spec File
specFile="$specsDir/$IssueId/specs.md"
if [ ! -f "$specFile" ]; then
    echo "Error: Spec file not found at $specFile" >&2
    exit 1
fi

echo "Pre-plan checks complete. Target Spec File: $specFile"
echo "Target Plan File: $specsDir/$IssueId/plan.md"
