#!/bin/zsh
# Crawls the sources marked runsFrom: 'local' in scrapers/src/roasters/configs.ts from this machine,
# because their shops refuse requests from GitHub's network. Run nightly by launchd; see docs/local-refresh.md.
# The database token is read from the macOS Keychain and never written to disk.
set -eu
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "${0:A:h}/.."
echo "== $(date -u +%Y-%m-%dT%H:%M:%SZ) local refresh"
git fetch -q origin && git checkout -q --detach origin/main
[ scrapers/node_modules/.installed -nt scrapers/package-lock.json ] || { npm ci --prefix scrapers --silent && touch scrapers/node_modules/.installed; }
export CLOUDFLARE_ACCOUNT_ID='4c1a4493b8584296f35c3eddc8279112'
export CLOUDFLARE_D1_DATABASE_ID='5090f52d-546e-4ba6-bdcd-b4ee531a29a3'
export CLOUDFLARE_D1_API_TOKEN="$(security find-generic-password -a kahvedrop -s kahvedrop-d1-token -w)"
exec scrapers/node_modules/.bin/tsx scripts/v2-refresh.mts --local
