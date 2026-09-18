import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

test('the generated QR independently decodes to the canonical public project URL', async () => {
  const template = await readFile(new URL('../site/template.html', import.meta.url), 'utf8');
  const canonical = template.match(/<link rel="canonical" href="([^"]+)">/)[1];
  const png = PNG.sync.read(await readFile(new URL('../dist/project-qr.png', import.meta.url)));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded, 'QR must be independently decodable');
  assert.equal(decoded.data, new URL(canonical).href);
  assert.equal(png.width, 512);
  for (let x = 0; x < png.width; x++) {
    assert.deepEqual([...png.data.subarray(x * 4, x * 4 + 4)], [255, 255, 255, 255]);
  }
});

test('homepage and presentation opening slide share an accessible local QR asset', async () => {
  const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const overview = await readFile(new URL('../dist/overview.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../site/overview.mjs', import.meta.url), 'utf8');
  for (const page of [index, overview]) {
    assert.match(page, /class="project-qr"/);
    assert.match(page, /src="\.\/project-qr\.svg\?v=[a-f0-9]{12}"/);
    assert.match(page, /Scan to open the project/);
    assert.match(page, /ethical-tech-colab\.github\.io\/commons-collective\//);
    assert.doesNotMatch(page, /\{\{PROJECT_/);
  }
  assert.match(overview, /<template id="project-share">/);
  assert.match(app, /byId\('project-share'\)\.content\.cloneNode\(true\)/);
});
