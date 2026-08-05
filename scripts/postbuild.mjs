// GitHub Pages has no SPA rewrite rule: it serves 404.html for unknown paths.
// Shipping the built index as 404.html makes deep links such as /integrations resolve.
import { copyFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const dist = path.join(root, 'dist');

await access(path.join(dist, 'index.html'), constants.F_OK);
await copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'));

try {
  await access(path.join(dist, '.nojekyll'), constants.F_OK);
} catch {
  await writeFile(path.join(dist, '.nojekyll'), '');
}

console.log('postbuild: wrote dist/404.html SPA fallback');
