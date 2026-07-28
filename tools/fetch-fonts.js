/* Pull the woff2 files Google serves and rewrite the CSS to local paths.

   Two things matter here:
   - Google ships Inter (and JetBrains Mono) as a single variable woff2 and
     emits one @font-face per weight pointing at the *same* URL. Downloading
     per block means four identical copies, so files are deduped by URL and
     the weights collapse into a range.
   - Only latin + latin-ext are kept. unicode-range means latin-ext costs
     nothing at runtime unless such a character actually appears. */
const fs = require('fs');
const path = require('path');
const https = require('https');

const SRC  = process.argv[2];
const OUT  = process.argv[3];
const KEEP = ['latin', 'latin-ext'];

const css = fs.readFileSync(SRC, 'utf8');
fs.mkdirSync(OUT, {recursive: true});

const get = url => new Promise((res, rej) => {
  https.get(url, r => {
    if (r.statusCode !== 200) return rej(new Error(url + ' -> ' + r.statusCode));
    const c = [];
    r.on('data', d => c.push(d));
    r.on('end', () => res(Buffer.concat(c)));
  }).on('error', rej);
});

/* walk the file so each @font-face keeps the subset comment above it */
const blocks = [];
let subset = null, buf = null;
for (const line of css.split('\n')) {
  const m = line.match(/^\/\* ([a-z-]+) \*\/$/);
  if (m) { subset = m[1]; continue; }
  if (line.trim().startsWith('@font-face')) buf = {subset, text: ''};
  if (buf) {
    buf.text += line + '\n';
    if (line.trim() === '}') { blocks.push(buf); buf = null; }
  }
}

const pick = (b, re) => (b.text.match(re) || [])[1];

/* group by the file they point at */
const byUrl = new Map();
for (const b of blocks) {
  if (!KEEP.includes(b.subset)) continue;
  const url = pick(b, /url\(([^)]+)\)/);
  if (!url) continue;
  const rec = byUrl.get(url) || {
    url,
    subset: b.subset,
    family: pick(b, /font-family:\s*'([^']+)'/),
    style:  pick(b, /font-style:\s*(\w+)/) || 'normal',
    range:  (pick(b, /unicode-range:\s*([^;]+)/) || '').trim(),
    weights: []
  };
  rec.weights.push(Number(pick(b, /font-weight:\s*(\d+)/) || 400));
  byUrl.set(url, rec);
}

(async () => {
  const faces = [];
  let bytes = 0;

  for (const r of byUrl.values()) {
    const lo = Math.min(...r.weights), hi = Math.max(...r.weights);
    const slug = r.family.toLowerCase().replace(/\s+/g, '-') +
                 (r.style === 'italic' ? '-italic' : '') +
                 '-' + r.subset + '.woff2';

    const data = await get(r.url);
    fs.writeFileSync(path.join(OUT, slug), data);
    bytes += data.length;

    faces.push(
      `@font-face{font-family:'${r.family}';font-style:${r.style};` +
      `font-weight:${lo === hi ? lo : lo + ' ' + hi};font-display:swap;` +
      `src:url(assets/fonts/${slug}) format('woff2');unicode-range:${r.range}}`
    );
  }

  fs.writeFileSync(path.join(OUT, '_faces.css'), faces.join('\n'));

  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.woff2')).sort();
  console.log(`${files.length} files, ${(bytes / 1024).toFixed(0)}KB on disk\n`);
  for (const f of files) {
    console.log('  ' + f.padEnd(40) + (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + 'KB');
  }
  const latin = files.filter(f => !f.includes('latin-ext'))
    .reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`\nEnglish page actually downloads (latin only): ${(latin / 1024).toFixed(0)}KB`);
})();
