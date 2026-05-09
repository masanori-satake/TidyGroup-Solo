import json
import sys
import re
import os

def check_version_consistency():
    try:
        # 1. projects/app/manifest.json
        with open("projects/app/manifest.json", "r") as f:
            manifest_version = json.load(f).get("version")

        # 2. package.json
        with open("package.json", "r") as f:
            package_json = json.load(f)
            package_version = package_json.get("version")

        # 3. package-lock.json (if exists)
        lock_version = package_version
        lock_pkg_version = package_version
        if os.path.exists("package-lock.json"):
            with open("package-lock.json", "r") as f:
                package_lock_json = json.load(f)
                lock_version = package_lock_json.get("version")
                lock_pkg_version = package_lock_json.get("packages", {}).get("", {}).get("version")

        # 4. README.md (Badge)
        with open("README.md", "r") as f:
            readme_content = f.read()
            badge_match = re.search(r"img\.shields\.io/badge/version-([\d\.]+)-blue", readme_content)
            readme_version = badge_match.group(1) if badge_match else None

        versions = {
            "projects/app/manifest.json": manifest_version,
            "package.json": package_version,
            "package-lock.json": lock_version,
            "package-lock.json (packages[''])": lock_pkg_version,
            "README.md (badge)": readme_version,
        }

        print("Checking version consistency:")
        for source, version in versions.items():
            print(f"  - {source}: {version}")

        if len(set(versions.values())) > 1:
            print(f"\nError: Version mismatch detected!")
            return False

        print(f"\nAll versions are consistent: {package_version}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if not check_version_consistency():
        sys.exit(1)
