param(
    [Parameter(Mandatory=$true)][string]$IssueId
)

$configPath = "config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "config.json not found in the current directory."
    exit 1
}
$config = Get-Content $configPath | ConvertFrom-Json
$issueIdPattern = $config.issueIdPattern
$specsDir = $config.specsDir
$scriptsDir = $config.scriptsDir

if ($IssueId -match "$issueIdPattern-(\d+)") {
    $N = $matches[1]
} else {
    Write-Error "IssueId '$IssueId' does not match pattern '$issueIdPattern-N'."
    exit 1
}

# Check for Learnings
if (Test-Path "LEARNING.md") {
    Write-Host "[REQUIRED] LEARNING.md found. You MUST read its contents and respect its practices."
}

# Verify Plan Existence
$planFile = "$specsDir/$IssueId/plan.md"
if (-not (Test-Path $planFile)) {
    Write-Error "Plan file missing: $planFile. You MUST STOP IMMEDIATELY and ask the user if you should proceed."
    exit 1
}

# Branch Management
$currentBranch = git branch --show-current
if ($currentBranch -ne $IssueId) {
    $branchExists = git rev-parse --verify --quiet $IssueId
    if ($LASTEXITCODE -eq 0) {
        git checkout $IssueId
    } else {
        git checkout -b $IssueId
    }
}

# Transition Issue Status
if (Test-Path "$scriptsDir/process-backlog.js") {
    node "$scriptsDir/process-backlog.js" in-progress $N
}

Write-Host "Pre-implement checks complete. Ready to proceed."
