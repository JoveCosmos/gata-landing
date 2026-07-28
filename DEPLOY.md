# Deploying the GATA HUB landing page

## What this project is

A single static page. `index.html` carries all the CSS and JS inline; everything
else is images and fonts under `assets/`.

**There is no build step and nothing runs on the server.** Node and `sharp` are
development tools only — they optimise images and fetch fonts on your machine,
and their *output* is committed to the repo. The server just serves files.

| Path | Deployed? | What it is |
|---|---|---|
| `index.html` | ✅ | the whole site |
| `assets/` | ✅ | images (WebP) and fonts (woff2) |
| `deploy/` | ❌ | nginx config + this deploy script |
| `tools/` | ❌ | local image/font scripts |
| `server.js` | ❌ | local dev server (also provides the status proxies) |
| `package.json`, `node_modules/` | ❌ | dev dependency for `tools/` |

## First-time server setup

```bash
# 1. clone somewhere that is NOT the web root
sudo mkdir -p /srv && cd /srv
sudo git clone git@github.com:<you>/gata-landing.git
sudo chown -R $USER:$USER /srv/gata-landing

# 2. create the docroot
sudo mkdir -p /var/www/gata-landing

# 3. install the nginx site
sudo cp /srv/gata-landing/deploy/nginx.conf /etc/nginx/sites-available/gata-landing
sudo ln -s /etc/nginx/sites-available/gata-landing /etc/nginx/sites-enabled/
sudo mkdir -p /var/cache/nginx/gata_status
sudo nginx -t && sudo systemctl reload nginx

# 4. first publish
chmod +x /srv/gata-landing/deploy/deploy.sh
/srv/gata-landing/deploy/deploy.sh
```

Then confirm the three status proxies answer — the Status section is blank
without them:

```bash
for p in api/uptime/status-page/validators api/kuma/status/validators api/betterstack/badge.json; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' https://gatahub.zone/$p)  $p"
done
```

All three must be `200`.

## Everyday flow

On your machine:

```bash
npm run dev          # http://localhost:4000, with the status proxies
# edit index.html
git add -A && git commit -m "..." && git push
```

On the server:

```bash
/srv/gata-landing/deploy/deploy.sh
```

That is the whole loop. No build, no restart, no process manager.

## When you add or replace images

Put the original (any size, JPG/PNG/GIF) in `assets/nft/`, then:

```bash
npm install          # once, to get sharp
npm run images
```

This rewrites everything in `assets/nft/` to WebP capped at 560px wide —
tiles render at 158–330px, so 560 covers 2× displays. Animated GIFs stay
animated. Delete the originals, point `index.html` at the `.webp`, and commit
the result. This is what took the page from 19 MB to 3 MB; skipping it will
undo that.

## Fonts

Already self-hosted in `assets/fonts/` — the page makes **zero** third-party
requests. `npm run fonts` re-fetches them from Google only if you change which
families or weights the page uses; it dedupes the variable-font files Google
serves once per weight, and keeps only the latin and latin-ext subsets.

## Rolling back

The docroot is disposable — it is rebuilt from the repo every deploy:

```bash
cd /srv/gata-landing
git checkout <good-commit>
./deploy/deploy.sh
```

## Why not clone straight into the web root

Because `.git/`, `server.js` and `package.json` would all be publicly
fetchable, and `server.js` documents the proxy layout. The nginx config has a
404 rule as a backstop, but keeping the checkout outside the docroot is the
real fix.
