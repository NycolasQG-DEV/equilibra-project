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
