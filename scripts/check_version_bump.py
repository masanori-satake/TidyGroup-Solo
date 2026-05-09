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
    """
    Checks if projects/app/ has changes compared to the base branch,
    and if so, ensures the version has been bumped.
    """
    try:
        # 1. Check if there are ANY changes in projects/app/ compared to main
        # This includes staged, unstaged, and commits in the current branch
        cmd = ["git", "diff", "main", "--name-only", "projects/app/"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        changed_files = result.stdout.strip().split("\n")
        changed_files = [f for f in changed_files if f]

        if not changed_files:
            # No changes in projects/app/ compared to main
            return True

        # 2. Get the current version in the workspace
        manifest_path = "projects/app/manifest.json"
        if not os.path.exists(manifest_path):
            print(f"Error: {manifest_path} not found.")
            return False

        with open(manifest_path, "r") as f:
            current_version = json.load(f).get("version")

        # 3. Get the version in the main branch
        base_version = get_base_version()

        if base_version:
            if current_version == base_version:
                print(f"Error: Detected changes in 'projects/app/' compared to 'main', but version is still '{current_version}'.")
                print("Please increment the version number in 'projects/app/manifest.json' (and ensure consistency in other files).")
                print(f"Changed files:\n  " + "\n  ".join(changed_files[:10]))
                if len(changed_files) > 10:
                    print(f"  ... and {len(changed_files) - 10} more.")
                return False
            else:
                print(f"Version bump detected: {base_version} -> {current_version}")
        else:
            print("Could not determine base version from 'main'. Skipping bump check.")

        return True
    except Exception as e:
        print(f"Warning: Could not check version bump: {e}")
        return True # Don't block if we can't check

if __name__ == "__main__":
    if not check_version_bump():
        sys.exit(1)
