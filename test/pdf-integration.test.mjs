import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('the main report uses the controlled PDF download and print stylesheet last', async () => {
  const html = await read('dist/index.html');
  assert.match(html, /id="print" href="\.\/commons-collective\.pdf" download/);
  const links = [...html.matchAll(/<link rel="stylesheet"[^>]*>/g)].map(match => match[0]);
  assert.match(links.at(-1), /\.\/pdf\.css\?v=[a-f0-9]{12}" media="print"/);
  assert.doesNotMatch(await read('site/app.mjs'), /window\.print/);
  assert.doesNotMatch(await read('dist/overview.html'), /pdf\.css/);
  assert.match(await read('site/overview.mjs'), /window\.print/);
});

test('a current main-report PDF and content manifest exist', async () => {
  const root = new URL('../dist/', import.meta.url);
  const bytes = await readFile(new URL('commons-collective.pdf', root));
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(bytes.length > 10000);
  const pdf = await stat(new URL('commons-collective.pdf', root));
  const html = await stat(new URL('index.html', root));
  assert.ok(pdf.mtimeMs >= html.mtimeMs, 'regenerate PDF after the site build');
  const manifest = JSON.parse(await read('dist/commons-collective.pdf.checks.json'));
  assert.equal(manifest.headings[0].id, 'abstract');
  assert.ok(manifest.headings.filter(item => /^\d+\./.test(item.text)).length >= 30);
  assert.ok(manifest.images.every(image => image.width > 0 && image.height > 0));
});
