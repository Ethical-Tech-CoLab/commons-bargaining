import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateWorkshop, validateWorkshopPlacements, expandWorkshopMarkers,
  validateConferenceReview, renderNodeMechanisms, workshopPresentationSection,
} from '../scripts/workshop.mjs';
import { renderResearch } from '../scripts/render-research.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const source = JSON.parse(await read('research/workshop-statements.json'));
const map = JSON.parse(await read('research/workshop-map.json'));
const notes = JSON.parse(await read('research/conference-notes-review.json'));
const nodes = JSON.parse(await read('research/node-mechanisms.json'));
const report = await read('research/report.md');
const registry = [
  ...JSON.parse(await read('research/sources.json')),
  ...JSON.parse(await read('research/replication-sources.json')),
];
const { headings } = renderResearch(report, new Set(registry.map(item => item.id)));
const workshop = validateWorkshop(source, map, headings);

test('all photographed directions have an exact report placement and valid source links', () => {
  validateWorkshopPlacements(report, workshop);
  assert.equal(workshop.cards.size, 7);
  assert.equal(workshop.mappings.size, 7);
  assert.equal(workshopPresentationSection(workshop).paragraphs.length, 9);
  assert.throws(() => validateWorkshopPlacements(report.replace('<!-- workshop:brief -->', ''), workshop), /incomplete/);
  const wrong = report.replace('<!-- workshop:brief -->', '<!-- workshop:zoe-cullen -->');
  assert.throws(() => validateWorkshopPlacements(wrong, workshop), /mapped section/);
});

test('unknown and duplicate source placements fail rather than dropping statements', () => {
  const badMap = structuredClone(map);
  badMap.mappings[0].primaryTitle = 'A missing section';
  assert.throws(() => validateWorkshop(source, badMap, headings), /primary section missing/);
  const duplicate = structuredClone(source);
  duplicate.cards[1].id = duplicate.cards[0].id;
  assert.throws(() => validateWorkshop(duplicate, map, headings), /duplicate workshop card/);
  assert.throws(() => expandWorkshopMarkers('<!-- workshop:unknown -->', workshop, new Map()), /Unknown workshop card/);
});

test('the supplied note is reviewed as an excerpt, not falsely claimed full-document access', () => {
  validateConferenceReview(notes, workshop);
  assert.match(notes.accessBasis, /excerpt supplied directly by the user/);
  assert.match(notes.accessBasis, /not independently accessed/);
  assert.doesNotMatch(JSON.stringify(notes), /docs\.google\.com\/document/);
  for (const id of ['contribution-withholding', 'mixed-traces', 'intervention-modes',
    'two-cmo-collaboration', 'quality-signals', 'trace-donation-and-shareback']) {
    assert.ok(notes.directions.some(item => item.id === id));
  }
});

test('all ten request nodes have four distinct proposed intervention lenses', () => {
  const html = renderNodeMechanisms(nodes);
  assert.equal(nodes.nodes.length, 10);
  assert.equal((html.match(/<th scope="row">/g) ?? []).length, 10);
  for (const key of ['market', 'policy', 'nonMarket', 'philanthropic']) {
    assert.ok(nodes.nodes.every(node => typeof node[key] === 'string' && node[key].length > 20));
  }
  assert.match(html, /not findings/);
});

test('published report and source page expose the original, every crop, and the editorial mapping', async () => {
  const main = await read('dist/index.html');
  const page = await read('dist/workshop.html');
  for (const card of source.cards) {
    assert.ok(main.includes(`id="workshop-${card.id}"`));
    assert.ok(page.includes(`id="source-${card.id}"`));
    assert.ok(main.includes(card.cropUrl));
    assert.ok(page.includes(card.cropUrl));
  }
  assert.match(main, /Tomicah Tillemann/);
  assert.match(main, /Sonam Jindal/);
  assert.match(main, /No individual attribution printed/);
  assert.match(main, /MIDs \(mediator intermediaries\)/);
  assert.match(page, /Author line as supplied/);
  assert.match(page, /Source cue \(abridged\)/);
  assert.match(page, /not verified spoken quotations/);
  assert.doesNotMatch(main, /<!--\s*workshop:/);
});
