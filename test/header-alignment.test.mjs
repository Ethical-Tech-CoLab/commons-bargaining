import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [header, overview, main, overviewHtml, headerHtml] = await Promise.all(
  ['site/header.css', 'site/overview.css', 'site/styles.css', 'site/overview.html', 'site/header.html']
    .map(path => readFile(new URL(path, root), 'utf8')),
);

test('the shared header uses the main page content measure without applying its gutters twice', () => {
  assert.match(main, /main,header,footer\{max-width:1440px;margin:auto\}/);
  assert.match(main, /\.hero\{padding:5rem 5vw 3\.5rem;/);
  assert.match(header, /:root\s*\{[^}]*--site-content-width:\s*calc\(min\(1440px, 100%\) - 10vw\);/);
  assert.match(header, /\.header-inner\s*\{[^}]*width: var\(--site-content-width\);[^}]*margin: 0 auto;[^}]*padding: 12px 0;/);
  assert.match(header, /@media \(max-width: 560px\)\s*\{\s*\.header-inner \{ gap: 8px; padding: 10px 0; \}/);
});

test('overview content, controls and footer inherit the shared header measure', () => {
  assert.match(overviewHtml, /\{\{HEADER\}\}/);
  assert.equal((headerHtml.match(/class="header-inner"/g) ?? []).length, 1);
  assert.match(overviewHtml, /href="\.\/header\.css"/);
  assert.match(overview, /main, \.overview-footer \{ width: var\(--site-content-width\); margin: 0 auto; \}/);
  assert.doesNotMatch(overview, /\.header-inner\s*\{/);
  assert.match(overviewHtml, /<main[^>]*>[\s\S]*class="slide-controls"[\s\S]*<\/main>/);
  assert.doesNotMatch(overview, /width: min\(1440px, 90%\)/);
});

test('overview retains its compact controls and full-width all-slide print layout', () => {
  assert.match(overview, /@media \(max-width: 560px\)[\s\S]*\.slide-controls button \{ min-width: auto;/);
  assert.match(overview, /@media print[\s\S]*main \{ width: 100%; padding: 0; \}/);
  assert.match(overview, /\.slide, \.slide\[hidden\] \{ display: block !important;/);
  assert.match(header, /@media print\s*\{\s*\.site-header \{ display: none; \}/);
});
