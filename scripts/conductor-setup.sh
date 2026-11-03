#!/bin/bash
# conductor-setup.sh — runs once in every new Conductor workspace.
# 1) makes sure the private files (keys + Catalyst project settings) are present — they are never on GitHub;
# 2) installs the packages the two Catalyst functions need.
cd "${CONDUCTOR_WORKSPACE_PATH:-$(pwd)}" || exit 1
SECRETS="$HOME/.premortem-secrets"   # private backup on this Mac (made once; not in git)
for f in keys.txt catalyst/.catalystrc catalyst/functions/api/catalyst-config.json catalyst/functions/researcher/catalyst-config.json; do
  [ -f "$f" ] && continue
  mkdir -p "$(dirname "$f")"
  if [ -n "$CONDUCTOR_ROOT_PATH" ] && [ -f "$CONDUCTOR_ROOT_PATH/$f" ]; then cp "$CONDUCTOR_ROOT_PATH/$f" "$f"
  elif [ -f "$SECRETS/$f" ]; then cp "$SECRETS/$f" "$f"
  else echo "⚠️  Missing $f — copy it from the original premortem folder (it holds private keys)."; fi
done
for fn in api researcher; do (cd "catalyst/functions/$fn" && npm install --silent --no-audit --no-fund) || echo "⚠️  npm install failed in $fn"; done
echo "✓ premortem workspace ready. Deploy with:  cd catalyst && node deploy.js"
