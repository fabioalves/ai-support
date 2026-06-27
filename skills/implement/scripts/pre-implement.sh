#!/usr/bin/env bash
# pre-implement.sh
# Bash version of pre-implement.ps1 for cross-platform compatibility.

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

# Branch Checking and Management
currentBranch=$(git branch --show-current)
branchExists=false
if [ "$currentBranch" = "$IssueId" ]; then
    branchExists=true
else
    if git rev-parse --verify --quiet "$IssueId" >/dev/null 2>&1; then
        branchExists=true
    fi
fi

if [ "$branchExists" = true ]; then
    if [ "$currentBranch" != "$IssueId" ]; then
        git checkout "$IssueId"
    fi
fi

# Verify Plan Existence
planFile="$specsDir/$IssueId/plan.md"
if [ ! -f "$planFile" ]; then
    echo "Error: Plan file missing: $planFile. You MUST STOP IMMEDIATELY and ask the user if you should proceed." >&2
    exit 1
fi

if [ "$branchExists" = false ]; then
    git checkout -b "$IssueId"
fi

# Transition Issue Status
if [ -f "$scriptsDir/process-backlog.js" ]; then
    node "$scriptsDir/process-backlog.js" in-progress "$N"
fi

echo "Pre-implement checks complete. Ready to proceed."
