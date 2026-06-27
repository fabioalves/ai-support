#!/usr/bin/env bash
# install-skills.sh
# Bash version of install-skills.ps1 for cross-platform compatibility.

set -e

# Get script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sourceSkillsPath="$SCRIPT_DIR/skills"

# Paths for the global skills directories (using HOME variable)
antigravitySkillsPath="$HOME/.gemini/antigravity-cli/skills"
claudeSkillsPath="$HOME/.claude/skills"

install_skills() {
    local source_dir="$1"
    local dest_dir="$2"

    if [ ! -d "$source_dir" ]; then
        echo "Error: Source skills directory not found at $source_dir" >&2
        return 1
    fi

    if [ ! -d "$dest_dir" ]; then
        echo "Destination directory does not exist. Creating $dest_dir..."
        mkdir -p "$dest_dir"
    fi

    echo "Copying skills to $dest_dir..."

    # Iterate over the skills in the workspace and copy them over
    for dir in "$source_dir"/*/; do
        if [ -d "$dir" ]; then
            # Strip trailing slash to get the skill name
            skillName=$(basename "$dir")
            echo " -> Installing skill: $skillName"
            
            # Use cp -R to copy recursively, making sure target exists
            mkdir -p "$dest_dir/$skillName"
            cp -R "$dir"* "$dest_dir/$skillName/"
        fi
    done
    echo -e "Successfully installed skills to $dest_dir.\n"
}

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}Which agents would you like to install the skills for?${NC}"
echo "  1) Antigravity"
echo "  2) Claude Code"
echo "  3) Both (Antigravity & Claude Code)"
echo "  0) Cancel"
echo ""

read -p "Please enter your choice(s) (e.g., 1, 2, or 3): " selection

installAntigravity=false
installClaude=false

if [[ "$selection" =~ "1" ]]; then installAntigravity=true; fi
if [[ "$selection" =~ "2" ]]; then installClaude=true; fi
if [[ "$selection" =~ "3" ]]; then
    installAntigravity=true
    installClaude=true
fi

if [ "$installAntigravity" = false ] && [ "$installClaude" = false ]; then
    echo -e "${YELLOW}Installation cancelled or no valid selection made.${NC}"
    exit 0
fi

if [ "$installAntigravity" = true ]; then
    echo -e "${GREEN}=== Installing for Antigravity ===${NC}"
    install_skills "$sourceSkillsPath" "$antigravitySkillsPath"
fi

if [ "$installClaude" = true ]; then
    echo -e "${GREEN}=== Installing for Claude Code ===${NC}"
    install_skills "$sourceSkillsPath" "$claudeSkillsPath"
fi
