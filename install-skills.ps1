$sourceSkillsPath = Join-Path $PSScriptRoot "skills"

# Paths for the global skills directories
$antigravitySkillsPath = Join-Path $env:USERPROFILE ".gemini\antigravity-cli\skills"

# Note: The exact path for Claude Code skills might vary depending on the setup. 
# Typical global configurations might reside in ~/.claude or similar. Update if your path differs.
$claudeSkillsPath = Join-Path $env:USERPROFILE ".claude\skills"

function Install-Skills {
    param([string]$Source, [string]$Destination)
    
    if (-not (Test-Path $Source)) {
        Write-Error "Source skills directory not found at $Source"
        return
    }

    if (-not (Test-Path $Destination)) {
        Write-Host "Destination directory does not exist. Creating $Destination..."
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }
    
    Write-Host "Copying skills to $Destination..."
    
    # Iterate over the skills in the workspace and copy them over
    Get-ChildItem -Path $Source -Directory | ForEach-Object {
        $skillName = $_.Name
        Write-Host " -> Installing skill: $skillName"
        Copy-Item -Path $_.FullName -Destination $Destination -Recurse -Force
    }
    Write-Host "Successfully installed skills to $Destination.`n"
}

Write-Host "Which agents would you like to install the skills for?" -ForegroundColor Cyan
Write-Host "  1) Antigravity"
Write-Host "  2) Claude Code"
Write-Host "  3) Both (Antigravity & Claude Code)"
Write-Host "  0) Cancel"
Write-Host ""

$selection = Read-Host "Please enter your choice(s) (e.g., 1, 2, or 3)"

$installAntigravity = $false
$installClaude = $false

if ($selection -match "1") { $installAntigravity = $true }
if ($selection -match "2") { $installClaude = $true }
if ($selection -match "3") { 
    $installAntigravity = $true 
    $installClaude = $true 
}

if (-not $installAntigravity -and -not $installClaude) {
    Write-Host "Installation cancelled or no valid selection made." -ForegroundColor Yellow
    exit
}

if ($installAntigravity) {
    Write-Host "=== Installing for Antigravity ===" -ForegroundColor Green
    Install-Skills -Source $sourceSkillsPath -Destination $antigravitySkillsPath
}

if ($installClaude) {
    Write-Host "=== Installing for Claude Code ===" -ForegroundColor Green
    Install-Skills -Source $sourceSkillsPath -Destination $claudeSkillsPath
}
