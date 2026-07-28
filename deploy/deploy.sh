#!/usr/bin/env bash
#
# Run on the server. Pulls the latest commit and publishes the two things
# that are actually public: index.html and assets/.
#
# There is no build. The site is static; the repo already contains the
# finished .webp and .woff2 files. Nothing here starts a process — nginx
# is already serving the docroot.
#
#   sudo -u deploy /srv/gata-landing/deploy/deploy.sh
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/gata-landing}"
DOCROOT="${DOCROOT:-/var/www/gata-landing}"
BRANCH="${BRANCH:-main}"

cd "$REPO_DIR"

echo "==> fetching $BRANCH"
git fetch --prune origin
before="$(git rev-parse HEAD)"

# --ff-only: if this fails, someone edited files on the server. Fix that
# rather than forcing, or the change is silently lost.
git pull --ff-only origin "$BRANCH"
after="$(git rev-parse HEAD)"

if [ "$before" = "$after" ]; then
  echo "==> already up to date at ${after:0:8}"
else
  echo "==> ${before:0:8} -> ${after:0:8}"
  git --no-pager log --oneline "$before..$after" | sed 's/^/    /'
fi

echo "==> publishing to $DOCROOT"
mkdir -p "$DOCROOT"

# assets/ mirrors exactly, so deleted images disappear from the docroot too
rsync -a --delete assets/ "$DOCROOT/assets/"
install -m 644 index.html "$DOCROOT/index.html"

echo "==> done"
echo "    $(find "$DOCROOT" -type f | wc -l) files, $(du -sh "$DOCROOT" | cut -f1)"
echo
echo "Note: nginx needs no reload for content changes."
echo "If deploy/nginx.conf changed, apply it deliberately:"
echo "    sudo cp deploy/nginx.conf /etc/nginx/sites-available/gata-landing"
echo "    sudo nginx -t && sudo systemctl reload nginx"
