#!/usr/bin/env bash
# Install the repo's git hooks into .git/hooks.
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"
src="$repo_root/scripts/hooks/pre-commit"
dst="$repo_root/.git/hooks/pre-commit"
cp "$src" "$dst"
chmod +x "$dst"
echo "✅ Installed pre-commit hook -> $dst"
command -v gitleaks >/dev/null 2>&1 \
  && echo "✅ gitleaks found: $(gitleaks version)" \
  || echo "⚠️  gitleaks not installed. Run: brew install gitleaks"
