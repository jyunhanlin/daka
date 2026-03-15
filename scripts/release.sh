#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.2.0"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Update tauri.conf.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$ROOT/app/src-tauri/tauri.conf.json"

# Update Cargo.toml (only the package version line under [package])
awk -v ver="$VERSION" '/^\[package\]/{found=1} found && /^version = /{sub(/version = ".*"/, "version = \"" ver "\""); found=0} 1' "$ROOT/app/src-tauri/Cargo.toml" > "$ROOT/app/src-tauri/Cargo.toml.tmp"
mv "$ROOT/app/src-tauri/Cargo.toml.tmp" "$ROOT/app/src-tauri/Cargo.toml"

echo "Updated version to $VERSION"
echo ""
echo "Files changed:"
git -C "$ROOT" diff --name-only
echo ""
echo "Next steps:"
echo "  git add -A && git commit -m \"chore: bump version to $VERSION\""
echo "  git tag v$VERSION"
echo "  git push origin main --tags"
