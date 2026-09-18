import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const sources = JSON.parse(await readFile(new URL('../research/sources.json', import.meta.url), 'utf8'));

test('all internal anchors resolve without duplicate ids', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate HTML IDs');
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.includes(anchor), `missing anchor ${anchor}`);
  }
});
test('local linked assets exist', async () => {
  for (const [, path] of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) {
    await access(new URL(`../dist/${path}`, import.meta.url));
  }
});
test('bibliography has verified metadata and every source is referenced', () => {
  assert.ok(sources.length >= 25);
  for (const source of sources) {
    assert.match(html, new RegExp(`href="#ref-${source.id}"`));
    assert.equal(source.accessed, '2026-09-18');
    assert.ok(source.claim && source.limit);
  }
});
test('research covers requested surfaces and labels its limits', () => {
  for (const term of ['Alice', 'Bob', 'Humanity AI', 'Creative Commons', 'synthetic',
    'Gmail', 'Costco', 'energy', 'philanthrop', 'antitrust', 'Tomica', 'Sonam',
    'Ilan', 'payment', 'knowledge object', 'not peer-reviewed', 'Field-grounded',
    'Pigouvian', 'Sanders', 'Wikimedia', 'Treasury payment', 'What Is Privacy Worth']) {
    assert.ok(html.toLowerCase().includes(term.toLowerCase()), `missing ${term}`);
  }
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
});
test('example is explicitly fictional and grants no blanket training permission', async () => {
  const example = JSON.parse(await readFile(new URL('../examples/knowledge-object.json', import.meta.url)));
  assert.equal(example.syntheticExample, true);
  assert.ok(example.rights.prohibitedPurpose.includes('model-training'));
  assert.equal(example.mandate.historicalUseErasureGuaranteed, false);
  const benefits = example.benefits;
  assert.equal(benefits.memberPoolBps + benefits.commonsBps + benefits.operationsBps + benefits.reserveBps, 10000);
});

test('divergence map has all ten request nodes and a pair of governance choices at every node', async () => {
  const svg = await readFile(new URL('../dist/divergence.svg', import.meta.url), 'utf8');
  const page = await readFile(new URL('../dist/divergence.html', import.meta.url), 'utf8');
  assert.equal([...svg.matchAll(/<g aria-label="Stage /g)].length, 10);
  assert.equal([...svg.matchAll(/class="risk-card"/g)].length, 10);
  assert.equal([...svg.matchAll(/class="commons-card"/g)].length, 10);
  for (const term of ['protocols', 'browser', 'example.com', 'Cloudflare', 'database',
    'compute', 'provenance', 'payment', 'energy', 'text-equivalent']) {
    assert.ok(page.toLowerCase().includes(term.toLowerCase()), `missing diagram topic ${term}`);
  }
  assert.match(page, /Return to the research/);
  assert.match(svg, /<title id="diagram-title">/);
  assert.match(svg, /<desc id="diagram-description">/);
});
