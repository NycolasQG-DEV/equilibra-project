const fs = require('node:fs');
const path = require('node:path');

async function downloadFonts() {
  const dir = path.join(__dirname, '..', 'public', 'vendor', 'fonts');
  fs.mkdirSync(dir, { recursive: true });

  const res = await fetch('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const css = await res.text();

  const blocks = css.split('@font-face').slice(1);
  const latinBlocks = [];

  for (const block of blocks) {
    if (block.includes('/* latin */') || block.includes('unicode-range: U+0000-00FF')) {
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      const urlMatch = block.match(/url\((https:[^)]+\.woff2)\)/);
      if (weightMatch && urlMatch) {
        const weight = weightMatch[1];
        const url = urlMatch[1];
        const filename = `plus-jakarta-sans-latin-${weight}.woff2`;
        console.log(`Downloading weight ${weight} from ${url}`);
        const fontRes = await fetch(url);
        const buffer = Buffer.from(await fontRes.arrayBuffer());
        fs.writeFileSync(path.join(dir, filename), buffer);
        latinBlocks.push({ weight, filename });
      }
    }
  }

  let localCss = '/* Local Plus Jakarta Sans fonts */\n';
  for (const { weight, filename } of latinBlocks) {
    localCss += `@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('/vendor/fonts/${filename}') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`;
  }
  fs.writeFileSync(path.join(dir, 'fonts.css'), localCss, 'utf8');
  console.log(`Successfully downloaded ${latinBlocks.length} fonts and generated fonts.css.`);
}

downloadFonts().catch(err => {
  console.error('Font download failed:', err);
  process.exit(1);
});
