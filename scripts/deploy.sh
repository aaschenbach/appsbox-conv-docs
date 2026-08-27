#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLISH=/var/www/appsbox-conv-documentos
RELEASE="$(date +%Y%m%d%H%M%S)"
STAGING="$(mktemp -d)"
DEPLOY_USER="$(id -un)"
trap 'rm -rf "$STAGING"' EXIT
cd "$ROOT"
npm ci
npm run check
npm run build
install -d "$STAGING/assets" "$STAGING/vendor"
install -m 0644 public/index.html public/style.css public/manifest.webmanifest public/service-worker.js public/robots.txt public/sitemap.xml public/ads.txt "$STAGING/"
JS_MODULES="main formats docx pdf text-formats afm-widths csv rtf odt epub"
for m in $JS_MODULES; do install -m 0644 "dist/$m.js" "$STAGING/"; done
install -m 0644 public/vendor/jszip.js "$STAGING/vendor/jszip.js"
cp -a public/vendor/pdfjs "$STAGING/vendor/pdfjs"
cp -a public/converter "$STAGING/converter"
install -m 0644 public/assets/appsboxconvdocslogo.png "$STAGING/assets/appsboxconvdocslogo.png"
sed -i "s/>desenvolvimento</>$RELEASE</; s/__RELEASE__/$RELEASE/g" "$STAGING/index.html"
sed -i "s/appsbox-conv-documentos-v2/appsbox-conv-documentos-$RELEASE/" "$STAGING/service-worker.js"
STAGED_JS=""
for m in $JS_MODULES; do STAGED_JS="$STAGED_JS $STAGING/$m.js"; done
for m in $JS_MODULES; do
  sed -i "s#from './$m.js'#from './$m.js?release=$RELEASE'#g" $STAGED_JS
done
sed -i "s/__RELEASE__/$RELEASE/g" $STAGED_JS
find "$STAGING/converter" -name '*.html' -exec sed -i "s/__RELEASE__/$RELEASE/g" {} +
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0755 "$PUBLISH/releases" "$PUBLISH/releases/$RELEASE"
sudo cp -a "$STAGING/." "$PUBLISH/releases/$RELEASE/"
sudo chmod 0755 "$PUBLISH/releases/$RELEASE" "$PUBLISH/releases/$RELEASE/assets"
sudo ln -s "releases/$RELEASE" "$PUBLISH/.current-$RELEASE"
sudo mv -Tf "$PUBLISH/.current-$RELEASE" "$PUBLISH/current"
curl --fail --silent --show-error https://docs.appsbox.com.br/ >/dev/null
curl --fail --silent --show-error https://docs.appsbox.com.br/health >/dev/null
printf 'Release publicada: %s\n' "$RELEASE"
