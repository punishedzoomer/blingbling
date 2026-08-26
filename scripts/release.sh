#!/usr/bin/env bash
set -e

# ==============================================================================
# Bling Bling Automated Release & Homebrew Tap Update Script
# ==============================================================================
# Usage:
#   ./scripts/release.sh            # Automatically increments patch version (e.g. 0.1.1 -> 0.1.2)
#   ./scripts/release.sh patch      # Increments patch (0.1.1 -> 0.1.2)
#   ./scripts/release.sh minor      # Increments minor (0.1.1 -> 0.2.0)
#   ./scripts/release.sh major      # Increments major (0.1.1 -> 1.0.0)
#   ./scripts/release.sh 0.1.5      # Sets explicit version 0.1.5
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Read Current Version from package.json
CURRENT_VERSION=$(node -p "require('./v2/package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# 2. Determine Target Version
INPUT="${1:-patch}"

if [[ "$INPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$INPUT"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$INPUT" in
    patch)
      PATCH=$((PATCH + 1))
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    *)
      echo "❌ Invalid argument: $INPUT. Use patch, minor, major, or an explicit semver (e.g. 0.1.2)"
      exit 1
      ;;
  esac
  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
fi

echo "🚀 Releasing version: $NEW_VERSION"

# 3. Ensure we are on main and working tree is clean
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "⚠️  Current branch is '$CURRENT_BRANCH'. Switching to 'main'..."
  git checkout main
  if git show-ref --verify --quiet refs/heads/dev; then
    echo "🔀 Merging latest 'dev' into 'main'..."
    git merge dev --no-edit
  fi
fi

# 4. Bump version in project config files
echo "📝 Updating version numbers across files..."

# v2/package.json
node -e "
  const pkg = require('./v2/package.json');
  pkg.version = '$NEW_VERSION';
  require('fs').writeFileSync('./v2/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# v2/src-tauri/tauri.conf.json
node -e "
  const conf = require('./v2/src-tauri/tauri.conf.json');
  conf.version = '$NEW_VERSION';
  require('fs').writeFileSync('./v2/src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

# v2/src-tauri/Cargo.toml
python3 -c "
import re
with open('./v2/src-tauri/Cargo.toml', 'r') as f:
    content = f.read()
content = re.sub(r'version = \"[^\"]+\"', 'version = \"$NEW_VERSION\"', content, count=1)
with open('./v2/src-tauri/Cargo.toml', 'w') as f:
    f.write(content)
"

# 5. Build Production DMG
echo "🔨 Building production Tauri DMG..."
cd "$ROOT_DIR/v2"
npm run tauri build
cd "$ROOT_DIR"

# 6. Locate DMG and compute SHA-256
DMG_PATH="$ROOT_DIR/v2/src-tauri/target/release/bundle/dmg/Bling Bling_${NEW_VERSION}_aarch64.dmg"

if [[ ! -f "$DMG_PATH" ]]; then
  # Fallback for underscore/space naming
  DMG_PATH=$(find "$ROOT_DIR/v2/src-tauri/target/release/bundle/dmg" -name "*${NEW_VERSION}*.dmg" | head -n 1)
fi

if [[ ! -f "$DMG_PATH" ]]; then
  echo "❌ Error: Could not find generated DMG at: $DMG_PATH"
  exit 1
fi

SHA256=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')
echo "🔑 Computed SHA-256: $SHA256"

# 7. Update Homebrew Cask Formula
echo "🍺 Updating Homebrew Cask (Casks/bling-bling.rb)..."
cat <<EOF > "$ROOT_DIR/Casks/bling-bling.rb"
cask "bling-bling" do
  version "${NEW_VERSION}"
  sha256 "${SHA256}"

  url "https://github.com/punishedzoomer/blingbling/releases/download/v#{version}/Bling.Bling_#{version}_aarch64.dmg",
      verified: "github.com/punishedzoomer/blingbling/"
  name "Bling Bling"
  desc "Sleek AI-powered desktop assistant built with Tauri and React"
  homepage "https://notosansdiary.com/Portfolio/Bling-Bling"

  depends_on macos: :catalina

  app "Bling Bling.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/Bling Bling.app"]
  end

  zap trash: [
    "~/Library/Application Support/BlingBling",
    "~/Library/Preferences/com.punishedzoomer.blingbling.plist",
    "~/Library/Saved Application State/com.punishedzoomer.blingbling.savedState",
  ]
end
EOF

# 8. Commit & Tag
echo "💾 Committing release and creating tag..."
git commit -am "chore(release): v${NEW_VERSION} and update Homebrew tap" || true
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}" || true

# 9. Sync changes back to dev branch
echo "🔄 Syncing release commit to 'dev' branch..."
git checkout dev
git merge main --no-edit
git checkout main

# 10. Push to GitHub
echo "🚀 Pushing branches and tags to GitHub..."
git push origin main dev --tags

# 11. Create GitHub Release with DMG attached
if command -v gh &> /dev/null; then
  echo "📦 Creating GitHub release v${NEW_VERSION}..."
  gh release create "v${NEW_VERSION}" \
    "${DMG_PATH}#Bling.Bling_${NEW_VERSION}_aarch64.dmg" \
    --title "v${NEW_VERSION}" \
    --generate-notes || echo "⚠️ GitHub release already exists or failed to upload."
fi

# 12. Update and Push to Homebrew Tap Repository
TAP_DIR="$(brew --repository)/Library/Taps/punishedzoomer/homebrew-tap"
if [[ -d "$TAP_DIR" ]]; then
  echo "🍺 Syncing and pushing to punishedzoomer/homebrew-tap..."
  cp "$ROOT_DIR/Casks/bling-bling.rb" "$TAP_DIR/Casks/bling-bling.rb"
  cd "$TAP_DIR"
  git add Casks/bling-bling.rb
  git commit -m "chore(release): bump bling-bling cask to v${NEW_VERSION}" || true
  git push origin main || true
  cd "$ROOT_DIR"
fi

echo ""
echo "=============================================================================="
echo "🎉 Release v${NEW_VERSION} is published and Homebrew Tap is live!"
echo "=============================================================================="
echo "Users can now install/upgrade immediately via:"
echo "  brew upgrade --cask bling-bling"
echo "=============================================================================="
