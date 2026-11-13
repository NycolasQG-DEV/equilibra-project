const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const [source, target] of [
  ['chart.js/dist/chart.umd.min.js', 'chart/chart.umd.min.js'],
  ['chart.js/LICENSE.md', 'chart/LICENSE.md'],
  ['@fortawesome/fontawesome-free/css/all.min.css', 'fontawesome/css/all.min.css'],
  ['@fortawesome/fontawesome-free/webfonts', 'fontawesome/webfonts'],
  ['@fortawesome/fontawesome-free/LICENSE.txt', 'fontawesome/LICENSE.txt'],
]) {
  const destination = path.join(root, 'public/vendor', target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(path.join(root, 'node_modules', source), destination, { recursive: true });
}

// Garante existência de public/vendor/fonts/fonts.css
const fontsDir = path.join(root, 'public/vendor/fonts');
fs.mkdirSync(fontsDir, { recursive: true });
const fontsCssPath = path.join(fontsDir, 'fonts.css');
if (!fs.existsSync(fontsCssPath)) {
  fs.writeFileSync(fontsCssPath, `/* Local self-hosted font definitions */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/vendor/fonts/inter.woff2') format('woff2');
}
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/vendor/fonts/inter.woff2') format('woff2');
}
`);
}
const fontWoff2 = path.join(fontsDir, 'inter.woff2');
if (!fs.existsSync(fontWoff2)) {
  const srcFont = path.join(root, 'public/vendor/fontawesome/webfonts/fa-regular-400.woff2');
  if (fs.existsSync(srcFont)) {
    fs.copyFileSync(srcFont, fontWoff2);
  }
}
