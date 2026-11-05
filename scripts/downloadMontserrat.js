const fs = require('node:fs');
const path = require('node:path');

async function downloadMontserrat() {
  const dir = path.join(__dirname, '..', 'public', 'vendor', 'fonts');
  fs.mkdirSync(dir, { recursive: true });

  const res = await fetch('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const css = await res.text();

  // Split into individual @font-face blocks with comments
  const blockPattern = /(\/\*[^*]*\*\/\s*)?@font-face\s*\{([^}]+)\}/g;
  const downloadedUrls = new Map(); // url -> filename
  const matchedBlocks = [];
  
  let match;
  while ((match = blockPattern.exec(css)) !== null) {
    const comment = (match[1] || '').trim();
    const blockBody = match[2];
    
    // Only process latin and latin-ext subsets
    const isLatin = comment.includes('/* latin */') || comment === '';
    const isLatinExt = comment.includes('/* latin-ext */');
    if (!isLatin && !isLatinExt) continue;
    
    const weightMatch = blockBody.match(/font-weight:\s*(\d+)/);
    const urlMatch = blockBodyrmatch(/url\((https:[^)]+\.woff2)\)/);
    const rangeMatch = blockBody.match(/unicode-range:\s*([^;]+);/);

    if (!weightMatch || !urlMatch) continue;

    const weight = weightMatch[1];
    const url = urlMatch[1];
    const range = rangeMatch ? rangeMatch[1].trim() : null;
    const suffix = isLatinExt ? 'latinext' : 'latin';
    const filename = `montserrat-${suffix}-${weight}.woff2`;

    // Download if not already downloaded
    if (!downloadedUrls.has(url)) {
      console.log(`Downloading ${filename} (${suffix}) weight ${weight}...`);
      const fontRes = await fetch(url);
      const buffer = Buffer.from(await fontRes.arrayBuffer());
      fs.writeFileSync(path.join(dir, filename), buffer);
      downloadedUrls.set(url, filename);
    }

    const actualFilename = downloadedUrls.get(url);
    matchedBlocks.push({ weight, filename: actualFilename, range, suffix });
  }

  // Sort: latin-ext first (more specific), then latin (fallback)
  matchedBlocks.sort((a, b) => {
    if (a.suffix === b.suffix) return parseInt(a.weight) - parseInt(b.weight);
    return a.suffix === 'latinext' ? -1 : 1;
  });

  let localCss = '/* Self-hosted Montserrat — weights 400-800, Latin & Latin-Ext subsets */\n';
  for (const { weight, filename, range } of matchedBlocks) {
    const rangeDecl = range ? `  unicode-range: ${range};\n` : '';
    localCss += `@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('/vendor/fonts/${filename}') format('woff2');
${rangeDecl}}\n`;
  }

  fs.writeFileSync(path.join(dir, 'fonts.css'), localCss, 'utf8');
  console.log(`Done: ${matchedBlocks.length} @font-face blocks in fonts.css.`);
  console.log('Files:', [...new Set(matchedBlocks.map(b => b.filename))].join(', '));
}

downloadMontserrat().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
