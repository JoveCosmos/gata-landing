/*
 * Dev server for the GATA HUB landing page.
 *
 *  - serves the static files in this folder
 *  - proxies /api/uptime/*      -> https://uptime.gatadao.com/api/*   (Kuma API)
 *  - proxies /api/kuma/*        -> https://uptime.gatadao.com/*       (Kuma status page)
 *  - proxies /api/betterstack/* -> https://gatahub.gatadao.com/*      (BetterStack)
 *
 * The proxies are not optional. Neither status host sends an
 * Access-Control-Allow-Origin header, and uptime.gatadao.com also sets
 * X-Frame-Options: SAMEORIGIN, so the browser can neither fetch() them
 * cross-origin nor iframe them. The status panel talks to same-origin
 * paths instead.
 *
 * In production, reproduce these two location blocks in nginx:
 *
 *   location /api/uptime/ {
 *     proxy_pass https://uptime.gatadao.com/api/;
 *     proxy_set_header Host uptime.gatadao.com;
 *   }
 *   location /api/kuma/ {
 *     proxy_pass https://uptime.gatadao.com/;
 *     proxy_set_header Host uptime.gatadao.com;
 *   }
 *   location /api/betterstack/ {
 *     proxy_pass https://gatahub.gatadao.com/;
 *     proxy_set_header Host gatahub.gatadao.com;
 *   }
 *
 * The alternative for Uptime Kuma is to add
 * `Access-Control-Allow-Origin: https://gatahub.zone` to its nginx config and
 * point the page straight at it — see UPTIME_BASE in index.html. BetterStack
 * is hosted, so its headers cannot be changed; that one needs the proxy.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const ROOT = __dirname;
const PROXIES = [
  {prefix:'/api/uptime/',      host:'uptime.gatadao.com',   base:'/api/'},
  {prefix:'/api/kuma/',        host:'uptime.gatadao.com',   base:'/'},
  {prefix:'/api/betterstack/', host:'gatahub.gatadao.com',  base:'/'}
];

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff2':'font/woff2', '.woff':'font/woff', '.txt':'text/plain; charset=utf-8'
};

function proxy(req, res, route) {
  const upstreamPath = route.base + req.url.slice(route.prefix.length);
  https.get({
    host: route.host,
    path: upstreamPath,
    headers: { 'accept': '*/*', 'user-agent': 'gata-landing-dev-proxy' }
  }, up => {
    res.writeHead(up.statusCode || 502, {
      'content-type': up.headers['content-type'] || 'application/json',
      'cache-control': 'no-store'
    });
    up.pipe(res);
  }).on('error', err => {
    res.writeHead(502, {'content-type':'application/json'});
    res.end(JSON.stringify({error:'upstream unreachable', host:route.host, detail:err.message}));
  });
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  const full = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!full.startsWith(ROOT)) {           // no traversal out of the project
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, {'content-type':'text/plain'}).end('Not found: ' + rel);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-cache',
      /* mirrors deploy/nginx.conf, so a CSP violation shows up here first */
      'content-security-policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; " +
        "frame-ancestors 'none'; base-uri 'self'"
    });
    fs.createReadStream(full).pipe(res);
  });
}

http.createServer((req, res) => {
  const route = PROXIES.find(p => req.url.startsWith(p.prefix));
  if (route) return proxy(req, res, route);
  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`GATA landing page  ->  http://localhost:${PORT}`);
  PROXIES.forEach(p => console.log(`proxy              ->  ${p.prefix}*  =>  https://${p.host}${p.base}*`));
});
