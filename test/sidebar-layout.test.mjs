import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, styles, header, paper, blueprint] = await Promise.all(
  ['dist/index.html', 'site/styles.css', 'site/header.css', 'site/paper.css', 'dist/blueprint.html']
    .map(path => readFile(new URL(path, root), 'utf8')),
);

test('the research sidebar holds only its contents and the disclosure lives in the footer', () => {
  const aside = html.match(/<aside>([\s\S]*?)<\/aside>/)?.[1];
  assert.ok(aside, 'research sidebar exists');
  assert.match(aside, /^\s*<div class="reading-sidebar">[\s\S]*<\/div>\s*$/);
  assert.match(aside, /<nav aria-label="Research contents" tabindex="0">[\s\S]*<\/nav>/);
  assert.doesNotMatch(aside, /Evidence, interpretation|endorsement|aside-note/);
  const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer);
  assert.match(footer, /<p class="evidence-note">Evidence, interpretation, and proposals are distinguished throughout\. No participant endorsement is implied\.<\/p>/);
  assert.equal((html.match(/class="evidence-note"/g) ?? []).length, 1);
});

test('the contents retain bounded independent scrolling without an overlaid note', () => {
  assert.match(styles, /\.reading-sidebar\{[^}]*position:sticky;[^}]*display:flex;flex-direction:column;[^}]*max-height:/);
  assert.match(styles, /\.reading-sidebar>nav\{[^}]*position:static;min-height:0;max-height:none;/);
  assert.match(styles, /aside nav\{[^}]*overflow:auto/);
  assert.doesNotMatch(styles, /\.reading-sidebar>\.aside-note/);
  assert.match(header, /\.reading-layout \.reading-sidebar,\s*\.reading-layout aside > nav\s*\{[^}]*top: calc\(var\(--header-height, 76px\) \+ 20px\);[^}]*max-height: calc\(100dvh - var\(--header-height, 76px\) - 40px\);/);
  assert.doesNotMatch(header, /\.reading-layout aside nav\s*\{/);
});

test('mobile, print and the companion paper keep their existing layout fallbacks', () => {
  assert.match(styles, /@media\(max-width:720px\)\{\.reading-sidebar\{position:static;max-height:none\}\}/);
  assert.match(header, /@media \(max-width: 720px\)\s*\{\s*\.reading-layout \.reading-sidebar,\s*\.reading-layout aside > nav \{ max-height: none; \}\s*\}/);
  assert.match(styles, /@media print\{[^]*?header,aside,[^{]*\{display:none\}/);
  assert.match(header, /\.site-header\s*\{[^}]*position: sticky;/);
  assert.match(blueprint, /<aside><nav aria-label="Paper contents">/);
  assert.doesNotMatch(paper, /\.paper-layout aside nav/);
});
