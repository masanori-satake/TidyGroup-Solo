import json
import subprocess
import sys
import os

def get_base_version():
    """
    Tries to get the version from manifest.json in the main branch.
    """
    try:
        # Check if we are in a git repo
        subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], check=True, capture_output=True)

        # Get the default branch name
        base_branch = "main"

        # Try to get the version from the base branch
        cmd = ["git", "show", f"{base_branch}:projects/app/manifest.json"]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            manifest = json.loads(result.stdout)
            return manifest.get("version")
        else:
            # If main doesn't exist or file doesn't exist there, return None
            return None
    except Exception:
        return None

def check_version_bump():
    # Only run on CI or if specifically requested, or detect if projects/app has changes
    # For a pre-commit hook, we want to know if projects/app/ is staged for commit.

    try:
        # Get staged files in projects/app/
        cmd = ["git", "diff", "--cached", "--name-only", "projects/app/"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        staged_files = result.stdout.strip().split("\n")
        staged_files = [f for f in staged_files if f]

        if not staged_files:
            # No changes in projects/app/, no bump needed
            return True

        # Current version
        with open("projects/app/manifest.json", "r") as f:
            current_version = json.load(f).get("version")

        base_version = get_base_version()

        if base_version and current_version == base_version:
            print(f"Error: Files in projects/app/ are modified, but version in manifest.json is still {current_version}.")
            print("Please increment the version number.")
            return False

        return True
    except Exception as e:
        print(f"Warning: Could not check version bump: {e}")
        return True # Don't block if we can't check

if __name__ == "__main__":
    if not check_version_bump():
        sys.exit(1)
