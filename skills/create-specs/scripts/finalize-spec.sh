#!/usr/bin/env bash
# finalize-spec.sh
# Bash version of finalize-spec.ps1 for cross-platform compatibility.

set -e

# Parse arguments
IssueNumber=""
IssueId=""
TempSpecPath=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--issue-number)
            IssueNumber="$2"
            shift 2
            ;;
        -i|--issue-id)
            IssueId="$2"
            shift 2
            ;;
        -t|--temp-spec-path)
            TempSpecPath="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

if [ -z "$IssueNumber" ] || [ -z "$IssueId" ] || [ -z "$TempSpecPath" ]; then
    echo "Usage: $0 -n <issue-number> -i <issue-id> -t <temp-spec-path>" >&2
    exit 1
fi

scriptsDir="scripts"
if [ -f "config.json" ]; then
    scriptsDir=$(node -e "console.log(require('./config.json').scriptsDir || 'scripts')")
fi

echo "Submitting and transitioning issue..."
node "$scriptsDir/process-backlog.js" update "$IssueNumber" --spec-file "$TempSpecPath"

echo "Committing and pushing the specs..."
git add specs/
git commit -m "docs: add specs for $IssueId"
git push

if [ -f "$TempSpecPath" ]; then
    echo "Cleaning up temporary files..."
    rm -f "$TempSpecPath"
fi
echo "Finalization complete!"
