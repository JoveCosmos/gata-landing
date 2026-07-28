/* Animated GIF -> animated WebP, plus PNG/JPEG -> WebP, in place. */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];

(async () => {
  const files = fs.readdirSync(DIR).filter(f => /\.(gif|png|jpe?g)$/i.test(f));
  let before = 0, after = 0;
  const rows = [];

  for (const f of files) {
    const src = path.join(DIR, f);
    const out = path.join(DIR, f.replace(/\.(gif|png|jpe?g)$/i, '.webp'));
    const animated = /\.gif$/i.test(f);
    const inSize = fs.statSync(src).size;

    try {
      /* Tiles render at 158–330px CSS; 560px covers 2x displays with room
         to spare. Never upscale the already-small sources. */
      await sharp(src, {animated})
        .resize({width: 560, withoutEnlargement: true})
        .webp({quality: 76, effort: 6})
        .toFile(out);

      const outSize = fs.statSync(out).size;
      before += inSize; after += outSize;
      rows.push([f, inSize, path.basename(out), outSize]);
    } catch (err) {
      rows.push([f, inSize, 'FAILED: ' + err.message, 0]);
    }
  }

  const mb = n => (n / 1048576).toFixed(2) + 'MB';
  for (const [a, ai, b, bi] of rows) {
    const pctSaved = bi ? (100 - (bi / ai) * 100).toFixed(0) + '%' : '-';
    console.log(`${a.padEnd(32)} ${mb(ai).padStart(8)}  ->  ${b.padEnd(30)} ${mb(bi).padStart(8)}  (-${pctSaved})`);
  }
  console.log(`\nTOTAL ${mb(before)} -> ${mb(after)}  (${(100 - (after / before) * 100).toFixed(0)}% smaller)`);
})();
