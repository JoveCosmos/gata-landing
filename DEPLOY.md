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
| `deploy/` | ❌ | nginx config + the deploy script |
| `tools/` | ❌ | local image/font scripts |
| `server.js` | ❌ | local dev server (also provides the status proxies) |
| `package.json`, `node_modules/` | ❌ | dev dependency for `tools/` |

## First-time server setup

### 0. Give the server read access

The repo is **private**, so the server cannot clone anonymously. Create a
read-only deploy key on the server — scoped to this one repo, so it cannot
touch anything else in the account:

```bash
ssh-keygen -t ed25519 -C "gata-landing deploy" -f ~/.ssh/gata_deploy -N ""
cat ~/.ssh/gata_deploy.pub
```

Paste that public key at
`https://github.com/JoveCosmos/gata-landing/settings/keys` → **Add deploy key**.
Leave *Allow write access* **unchecked** — the server only ever reads.

Then teach ssh to use it for this host:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-gata
    HostName github.com
    User git
    IdentityFile ~/.ssh/gata_deploy
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

ssh -T git@github-gata   # expect: "Hi JoveCosmos/gata-landing! You've successfully authenticated"
```

### 1. Clone and install

Clone somewhere that is **not** the web root:

```bash
sudo mkdir -p /srv && cd /srv
sudo git clone github-gata:JoveCosmos/gata-landing.git
sudo chown -R $USER:$USER /srv/gata-landing
sudo mkdir -p /var/www/gata-landing
```

### 2. Install the nginx site

Edit `deploy/nginx.conf` first — `server_name`, the certificate paths and the
docroot must match this box.

```bash
sudo cp /srv/gata-landing/deploy/nginx.conf /etc/nginx/sites-available/gata-landing
sudo ln -s /etc/nginx/sites-available/gata-landing /etc/nginx/sites-enabled/
sudo mkdir -p /var/cache/nginx/gata_status
sudo nginx -t && sudo systemctl reload nginx
```

### 3. First publish

```bash
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

## Automatic deploys (cron)

To skip the server-side step, have cron run the deploy script on a schedule.
It needs no GitHub secrets — the read-only deploy key is already on the box.

```bash
sudo crontab -e
```

Add one line:

```
*/5 * * * * /srv/gata-landing/deploy/deploy.sh >> /var/log/gata-deploy.log 2>&1
```

Push from your machine and the site updates within five minutes. `deploy.sh`
is safe to run repeatedly: with nothing new it prints "already up to date" and
rsync copies nothing.

```bash
tail -20 /var/log/gata-deploy.log     # what it has been doing
```

### How cron works, coming from systemd

cron is a daemon that reads a table of scheduled commands, the same job a
systemd timer does — but as one line instead of a `.timer` plus a `.service`.

| systemd | cron |
|---|---|
| `systemctl edit --full foo.timer` | `crontab -e` |
| `systemctl daemon-reload` | *nothing* — cron re-reads on save |
| `systemctl list-timers` | `crontab -l` |
| `journalctl -u foo` | whatever you redirect to, e.g. `/var/log/gata-deploy.log` |
| `OnCalendar=*:0/5` | `*/5 * * * *` |

Each user has their own table. `sudo crontab -e` edits **root's**;
`crontab -e` edits yours. They are different files, and a job listed in one is
invisible to the other — a common source of "but I added it".

The five fields before the command are
`minute hour day-of-month month day-of-week`:

```
*/5 * * * *     every 5 minutes
0 * * * *       top of every hour
30 4 * * *      04:30 daily
0 3 * * 1       03:00 every Monday
```

Never edit `/var/spool/cron/crontabs/*` by hand. `crontab -e` validates the
syntax and notifies the daemon; editing the file directly skips both.

### Two things that catch people

**The environment is nearly empty.** cron does not read `.bashrc` or
`.profile`, and `PATH` is usually just `/usr/bin:/bin`. A command that works in
your shell can fail here. Use absolute paths — which is why the line above
spells out `/srv/gata-landing/deploy/deploy.sh`.

**`HOME` decides which ssh key is used.** Under `sudo crontab`, jobs run as
root with `HOME=/root`, so git reads `/root/.ssh/config` for the `github-gata`
alias. If the deploy key was created under a different user, either use that
user's crontab or the pull will fail with `Permission denied (publickey)`.

### Checking and changing it

```bash
sudo crontab -l                       # list root's jobs
sudo crontab -e                       # edit; takes effect on save
grep CRON /var/log/syslog | tail      # confirm it is firing
```

Avoid `crontab -r` — it deletes the whole table with no confirmation. To remove
one job, `crontab -e` and delete the line.

The log grows forever, so cap it:

```bash
printf '/var/log/gata-deploy.log {\n  weekly\n  rotate 4\n  compress\n  missingok\n  notifempty\n}\n' | sudo tee /etc/logrotate.d/gata-deploy
```

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
