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
    'Pigouvian', 'Sanders', 'Wikimedia', 'Treasury payment', 'What Is Privacy Worth',
    'Soho House', 'supplier chamber', 'Free opt-in', 'Schedule G',
    'non-binding clause sketches', 'ERC-8004', 'task-local ordering',
    'eligible candidates', 'validation registries', 'Waze',
    'Weather Underground', 'quality-adjusted total cost']) {
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

test('both pages have shared permanent navigation with the requested labels', async () => {
  const diagram = await readFile(new URL('../dist/divergence.html', import.meta.url), 'utf8');
  for (const page of [html, diagram]) {
    assert.match(page, /class="site-header"/);
    assert.match(page, /aria-label="Primary navigation"/);
    assert.match(page, /data-nav="overview"[^>]*>Overview<\/a>/);
    assert.match(page, /data-nav="demos"[^>]*>Demos<\/a>/);
    assert.match(page, /data-nav="research"[^>]*>Research<\/a>/);
    assert.match(page, /\.\/header\.css\?v=[a-f0-9]{12}/);
    assert.doesNotMatch(page, /\{\{[A-Z_]+\}\}/);
  }
  assert.match(diagram, /data-nav="demos" aria-current="location"/);
  for (const [, anchor] of diagram.matchAll(/href="\.\/index\.html#([^"]+)"/g)) {
    assert.ok(html.includes(`id="${anchor}"`), `missing cross-page anchor ${anchor}`);
  }
});

test('the reputation sketch cannot masquerade as a verified evaluation or eligible candidate', async () => {
  const observation = JSON.parse(await readFile(new URL('../dist/reputation-observation.json', import.meta.url)));
  assert.equal(observation.publicationStatus, 'fictional-not-executed-demonstration');
  assert.equal(observation.sampleCount, 0);
  assert.equal(observation.outcome, null);
  assert.equal(observation.signature, null);
  assert.equal(observation.admissibility.eligibleForRanking, false);
  assert.equal(observation.overallTrustScore, null);
  assert.equal(observation.erc8004ConformanceClaimed, false);
});
