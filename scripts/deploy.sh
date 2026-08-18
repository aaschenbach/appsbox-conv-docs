#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLISH=/var/www/appsbox-conv-documentos
RELEASE="$(date +%Y%m%d%H%M%S)"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT
cd "$ROOT"
npm ci
npm run check
npm run build
install -d "$STAGING/assets"
install -m 0644 public/index.html public/style.css public/manifest.webmanifest public/service-worker.js "$STAGING/"
install -m 0644 dist/main.js "$STAGING/main.js"
install -m 0644 public/assets/appsboxconvdocslogo.png "$STAGING/assets/appsboxconvdocslogo.png"
sed -i "s/>desenvolvimento</>$RELEASE</" "$STAGING/index.html"
sed -i "s/appsbox-conv-documentos-v2/appsbox-conv-documentos-$RELEASE/" "$STAGING/service-worker.js"
sed -i "s/__RELEASE__/$RELEASE/g" "$STAGING/main.js"
sudo install -d -o ubuntu -g ubuntu -m 0755 "$PUBLISH/releases" "$PUBLISH/releases/$RELEASE"
sudo cp -a "$STAGING/." "$PUBLISH/releases/$RELEASE/"
sudo chmod 0755 "$PUBLISH/releases/$RELEASE" "$PUBLISH/releases/$RELEASE/assets"
sudo ln -s "releases/$RELEASE" "$PUBLISH/.current-$RELEASE"
sudo mv -Tf "$PUBLISH/.current-$RELEASE" "$PUBLISH/current"
curl --fail --silent --show-error https://docs.appsbox.com.br/ >/dev/null
curl --fail --silent --show-error https://docs.appsbox.com.br/health >/dev/null
printf 'Release publicada: %s\n' "$RELEASE"
