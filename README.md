# GATA HUB — landing page

Single-page site for [gatahub.zone](https://gatahub.zone): community links,
validators, public endpoints, live infrastructure status, and the NFT
collections. Sends visitors on to the reward app at
[reward.gatahub.zone](https://reward.gatahub.zone).

## Running it locally

```bash
npm install     # only needed for the tools/ scripts
npm run dev     # http://localhost:4000
```

`npm run dev` starts [`server.js`](server.js) — a zero-dependency static server
that also proxies the two status feeds (see below). Open
`http://localhost:4000` and edit [`index.html`](index.html); there is no watch
step, just reload.

While you are on `localhost`, the **Enter the App** buttons point at
`http://localhost:3000` instead of the live reward app, so you can test against
a local build of it. On any other hostname they use the real URL.

## How it is put together

One HTML file. All CSS and JS is inline, so the page is a single request plus
its images and fonts. No framework, no bundler, **no build step**.

| Path | Deployed | What it is |
|---|:--:|---|
| `index.html` | ✅ | the entire site — markup, styles, behaviour |
| `assets/` | ✅ | WebP images and self-hosted woff2 fonts |
| `server.js` | ❌ | local dev server + status proxies |
| `deploy/` | ❌ | nginx config and the server-side deploy script |
| `tools/` | ❌ | image optimiser and font fetcher |
| `package.json` | ❌ | dev dependency (`sharp`) for `tools/` |

Only `index.html` and `assets/` ever reach the web root.

## Editing the content

Everything on the page is driven by plain arrays near the bottom of
`index.html`. Add or remove an entry and it renders — no other change needed.

| What | Where |
|---|---|
| Social links | search `const SOCIALS` |
| NFT collections (Yield Series) | search `const YIELD` |
| NFT souvenirs / honorary | search `const SOUVENIRS` |
| Networks — validators, endpoints, snapshots, explorer, uptime | search `const NETWORKS` |
| Monitors to hide from Status | search `const STATUS_HIDE` |

Each network record carries per-service flags (`rpc`, `api`, `snap`, `scan`,
`val`) and its Kuma `monitor` name. Two URLs are derived, not stored: snapshots
live at `<rpc>/snapshots`, and GATA SCAN routes by chain id. The flags are not
uniform on purpose — Nomic has no snapshots and is not in the explorer — so
each sheet lists only what that network actually has.

`STATUS_HIDE` exists because the uptime monitor still tracks Namada, which the
page no longer lists. Pausing that monitor upstream would be the tidier fix.

## Live status

Every network card carries a small dot in its corner — green, red, or neutral —
and its detail sheet shows the current state and 24h uptime, both read live
from **Uptime Kuma** at `uptime.gatadao.com`.

Kuma sends no `Access-Control-Allow-Origin` header and blocks framing, so the
browser cannot read it directly. It is read through a **same-origin proxy path**:

```
/api/uptime/*  ->  uptime.gatadao.com/api/*
```

`server.js` provides this in development; `deploy/nginx.conf` does in
production. **Without it every dot stays neutral and the Uptime row reads "Checking…"** —
the rest of the page is unaffected.

Polling runs only while the infrastructure section is on screen and the tab is
focused, so idle visitors do not hammer the monitor.

## Images

Covers are optimised locally and the **output is committed** — the server never
processes anything.

```bash
npm run images    # assets/nft/*  ->  WebP, max 560px wide
```

Tiles render at 158–330px, so 560px covers 2× displays; animated GIFs stay
animated. This is what holds the page at ~3 MB instead of 19 MB, so run it
whenever you add or replace a cover, then point `index.html` at the `.webp`.

## Fonts

Self-hosted in `assets/fonts/` — Inter, Instrument Serif and JetBrains Mono.
The page makes **zero third-party requests**, which also means no CSP
exceptions and no Google Fonts privacy question.

```bash
npm run fonts     # only if you change families or weights
```

Google ships Inter and JetBrains Mono as variable fonts but emits one
`@font-face` per weight pointing at the same file; the script dedupes by URL
and collapses the weights into a range. Only latin and latin-ext are kept, and
`unicode-range` means latin-ext is fetched only if such a character actually
renders — about 120 KB for an English page.

## Deploying

See **[DEPLOY.md](DEPLOY.md)**. Short version: push, then on the server run
`/srv/gata-landing/deploy/deploy.sh`, which pulls and rsyncs `index.html` and
`assets/` into the docroot. Nothing is built and nothing is restarted.
