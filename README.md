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
| Mainnet validators | search `const VAL_MAIN` |
| Testnet validators | search `const VAL_TEST` |
| Mainnet endpoints | search `const EP_MAIN` |
| Testnet endpoints | search `const EP_TEST` |
| Monitors to hide from Status | search `const STATUS_HIDE` |

`STATUS_HIDE` exists because the uptime monitor still tracks networks the page
no longer lists (currently Namada and Stargaze). Pausing those monitors
upstream would be the tidier fix.

## The Status section

It reads two monitors live:

- **Uptime Kuma** — `uptime.gatadao.com`, per-service heartbeats and 24h uptime
- **BetterStack** — `gatahub.gatadao.com`, surfaced as the *Uptime* service card

Neither host sends an `Access-Control-Allow-Origin` header, and Kuma also sets
`X-Frame-Options: SAMEORIGIN`, so the browser can neither `fetch()` nor iframe
them directly. Both are read through **same-origin proxy paths** instead:

```
/api/uptime/*       ->  uptime.gatadao.com/api/*     (Kuma API)
/api/kuma/*         ->  uptime.gatadao.com/*         (Kuma status page)
/api/betterstack/*  ->  gatahub.gatadao.com/*        (BetterStack badge)
```

`server.js` provides these in development; `deploy/nginx.conf` does in
production. **Without them the Status section renders an explanatory notice
instead of live data** — that is the single most common thing to get wrong when
deploying.

If the monitor is unreachable the panel shows a full-outage state rather than
an error, and keeps retrying until it recovers. Polling only runs while the
Status section is open and the tab is focused, so idle visitors do not hammer
the monitors.

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
