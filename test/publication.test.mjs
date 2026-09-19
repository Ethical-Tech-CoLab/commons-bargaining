import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const sources = JSON.parse(await readFile(new URL('../dist/sources.json', import.meta.url), 'utf8'));

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
    'Weather Underground', 'quality-adjusted total cost', 'Commons Reward Trust',
    'reinforcement-learning reward', 'compensatory average', 'pro-human stack',
    'accountability tuple', 'funded exit/maintenance', 'Oh My Pi',
    'Commons Collective Agency Starter Kit', 'component passport',
    'commons service model', 'reserve-funding gap', 'quasi-commons',
    'not an independent audit', 'monthly active Wikimedia editors']) {
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

test('all publication pages have shared permanent navigation with the requested labels', async () => {
  const diagram = await readFile(new URL('../dist/divergence.html', import.meta.url), 'utf8');
  const overview = await readFile(new URL('../dist/overview.html', import.meta.url), 'utf8');
  const work = await readFile(new URL('../dist/open-work.html', import.meta.url), 'utf8');
  const blueprint = await readFile(new URL('../dist/blueprint.html', import.meta.url), 'utf8');
  for (const page of [html, diagram, overview, work, blueprint]) {
    assert.match(page, /class="site-header"/);
    assert.match(page, /aria-label="Primary navigation"/);
    assert.match(page, /data-nav="overview"[^>]*>Overview<\/a>/);
    assert.match(page, /data-nav="demos"[^>]*>Demos<\/a>/);
    assert.match(page, /data-nav="research"[^>]*>Research<\/a>/);
    assert.match(page, /\.\/header\.css\?v=[a-f0-9]{12}/);
    assert.doesNotMatch(page, /\{\{[A-Z_]+\}\}/);
  }
  assert.match(diagram, /data-nav="demos" aria-current="location"/);
  assert.match(overview, /data-nav="overview" aria-current="location"/);
  assert.match(work, /data-nav="research" aria-current="location"/);
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

test('all publication pages use the same green icon for the header and favicon', async () => {
  const diagram = await readFile(new URL('../dist/divergence.html', import.meta.url), 'utf8');
  const overview = await readFile(new URL('../dist/overview.html', import.meta.url), 'utf8');
  const work = await readFile(new URL('../dist/open-work.html', import.meta.url), 'utf8');
  const blueprint = await readFile(new URL('../dist/blueprint.html', import.meta.url), 'utf8');
  const icon = await readFile(new URL('../dist/favicon.svg', import.meta.url), 'utf8');
  assert.match(icon, /viewBox="0 0 28 28"/);
  assert.match(icon, /fill="#c8f04b"/);
  assert.equal([...icon.matchAll(/<circle /g)].length, 3);
  for (const page of [html, diagram, overview, work, blueprint]) {
    const favicon = page.match(/<link rel="icon"[^>]*href="([^"]+)"/);
    const headerIcon = page.match(/<img class="header-mark" src="([^"]+)"/);
    assert.ok(favicon && headerIcon);
    assert.match(favicon[1], /^\.\/favicon\.svg\?v=[a-f0-9]{12}$/);
    assert.equal(headerIcon[1], favicon[1]);
    await access(new URL(`../dist/${favicon[1]}`, import.meta.url));
  }
});

test('presentation and open-work sources match the published report and canonical register', async () => {
  const data = JSON.parse(await readFile(new URL('../dist/presentation-data.json', import.meta.url), 'utf8'));
  const canonical = JSON.parse(await readFile(new URL('../research/open-work.json', import.meta.url), 'utf8'));
  const work = await readFile(new URL('../dist/open-work.html', import.meta.url), 'utf8');
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.sourceCount, sources.length);
  assert.equal(data.workItems.length, canonical.items.length);
  assert.match(data.revision.contentHash, /^[a-f0-9]{12}$/);
  assert.ok(Number.isFinite(Date.parse(data.revision.builtAt)));
  const sectionById = new Map(data.sections.map(section => [section.id, section]));
  for (const section of data.sections) {
    const target = new URL(section.url, 'https://publication.invalid/');
    const document = await readFile(new URL(`../dist${target.pathname}`, import.meta.url), 'utf8');
    assert.ok(document.includes(`id="${target.hash.slice(1)}"`), `missing source target ${section.url}`);
  }
  for (const [index, item] of data.workItems.entries()) {
    assert.equal(item.question, canonical.items[index].question);
    assert.equal(item.status, canonical.items[index].status);
    assert.ok(work.includes(`id="${item.id}"`));
    for (const [sourceIndex, id] of item.sourceIds.entries()) {
      assert.ok(sectionById.has(id));
      assert.equal(item.sourceUrls[sourceIndex], sectionById.get(id).url);
    }
  }
  assert.match(work, /source of record/);
});

test('presentation and work-register pages have resolvable local assets and source links', async () => {
  for (const file of ['overview.html', 'open-work.html', 'blueprint.html']) {
    const page = await readFile(new URL(`../dist/${file}`, import.meta.url), 'utf8');
    const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, `duplicate ids in ${file}`);
    for (const [, anchor] of page.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.includes(anchor), `missing anchor ${anchor} in ${file}`);
    }
    for (const [, path] of page.matchAll(/(?:href|src)="\.\/([^"#]+)"/g)) {
      await access(new URL(`../dist/${path}`, import.meta.url));
    }
    for (const [, id] of page.matchAll(/href="\.\/index\.html#([^"]+)"/g)) {
      assert.ok(html.includes(`id="${id}"`), `missing report target ${id}`);
    }
  }
});

test('every divergence node explains the levers and tests that could change its bargain', async () => {
  const page = await readFile(new URL('../dist/divergence.html', import.meta.url), 'utf8');
  const cards = [...page.matchAll(/<li class="tipping-card"[\s\S]*?<\/li>/g)].map(match => match[0]);
  assert.equal(cards.length, 10);
  for (const card of cards) {
    for (const label of ['Countervailing power', 'Who organizes / acts', 'Enforceable instrument',
      'Observable proof / decision test', 'Remaining capture risk']) {
      assert.ok(card.includes(label), `missing tipping-point dimension ${label}`);
    }
  }
  const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const [, id] of page.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `missing diagram anchor ${id}`);
  for (const [, id] of page.matchAll(/href="\.\/index\.html#([^"]+)"/g)) {
    assert.ok(html.includes(`id="${id}"`), `missing diagram research link ${id}`);
  }
});

test('current publication branding and repository links use Commons Collective', async () => {
  for (const file of ['index.html', 'divergence.html', 'overview.html', 'open-work.html', 'blueprint.html']) {
    const page = await readFile(new URL(`../dist/${file}`, import.meta.url), 'utf8');
    assert.match(page, /Commons Collective/);
    assert.match(page, /github\.com\/Ethical-Tech-CoLab\/commons-collective/);
    assert.doesNotMatch(page, /Commons Bargaining|COMMONS BARGAINING|commons-bargaining/);
  }
  const data = JSON.parse(await readFile(new URL('../dist/presentation-data.json', import.meta.url)));
  assert.equal(data.project.title, 'Commons Collective');
});

test('the component passport is explicitly unfilled and does not approve an agent', async () => {
  const passport = JSON.parse(await readFile(new URL('../dist/component-passport.json', import.meta.url)));
  assert.equal(passport.status, 'unfilled-demonstration-not-approved');
  assert.equal(passport.component.releaseOrCommit, null);
  assert.equal(passport.evaluation.sampleCount, 0);
  assert.equal(passport.eligibility.approvedForUse, false);
  assert.equal(passport.eligibility.unknownMandatoryEvidenceBlocksApproval, true);
  assert.match(passport.notice, /do not prove runtime isolation/);
});

test('the companion paper and every declared replication artifact are published', async () => {
  const root = new URL('../', import.meta.url);
  const profile = JSON.parse(await readFile(new URL('templates/sector-profile.json', root)));
  for (const file of profile.packFiles) {
    const source = new URL(file, new URL('templates/', root));
    const relative = source.href.slice(root.href.length);
    await access(new URL(`dist/${relative}`, root));
  }
  const blueprint = await readFile(new URL('dist/blueprint.html', root), 'utf8');
  assert.match(blueprint, /replicable institution/);
  assert.match(blueprint, /not peer-reviewed/);
  assert.match(blueprint, /templates\/business-model\.md/);
  assert.match(blueprint, /href="\.\/index\.html#ref-S70"/);
  const data = JSON.parse(await readFile(new URL('dist/presentation-data.json', root)));
  assert.ok(data.sections.some(section => section.id === 'paper-replication-blueprint'
    && section.url === './blueprint.html#abstract'));
});
