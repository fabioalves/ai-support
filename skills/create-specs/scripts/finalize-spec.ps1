param(
    [Parameter(Mandatory=$true)][string]$IssueNumber,
    [Parameter(Mandatory=$true)][string]$IssueId,
    [Parameter(Mandatory=$true)][string]$TempSpecPath
)

$config = Get-Content "config.json" -ErrorAction SilentlyContinue | ConvertFrom-Json
$scriptsDir = if ($config.scriptsDir) { $config.scriptsDir } else { "scripts" }

Write-Host "Submitting and transitioning issue..."
node "$scriptsDir/process-backlog.js" update $IssueNumber --spec-file $TempSpecPath

Write-Host "Committing and pushing the specs..."
git add specs/
git commit -m "docs: add specs for $IssueId"
git push

if (Test-Path $TempSpecPath) {
    Write-Host "Cleaning up temporary files..."
    Remove-Item $TempSpecPath -Force
}
Write-Host "Finalization complete!"
