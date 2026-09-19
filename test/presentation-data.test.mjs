import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanionSection, createPresentationData } from '../scripts/presentation-data.mjs';

function input() {
  return {
    report: `## Abstract

Original **finding**. [S01]

## 5. From digital Costco to a bargaining federation

A proposed institution.

## 16. Research program and falsifiable hypotheses

An unanswered research question.

## 18. A ninety-day starting sequence

Test before deployment.`,
    headings: [
      { id: 'abstract' },
      { id: '5-from-digital-costco-to-a-bargaining-federation' },
      { id: '16-research-program-and-falsifiable-hypotheses' },
      { id: '18-a-ninety-day-starting-sequence' },
    ],
    template: `<h1 id="title">Commons<br><em>Collective.</em></h1>
      <p class="deck">A current project question.</p>
      <span class="status">DISCUSSION DRAFT &middot; v0.1</span>
      <section class="thesis"><p class="eyebrow">Thesis</p><p>Shared <strong>agency</strong>.</p></section>
      <h2 id="lab-title">Settlement calculator</h2><p>A fictional demonstration.</p>`,
    diagramTemplate: '<h1>Divergence diagram</h1><p class="lede">Ten proposed bargaining points.</p>',
    work: {
      schemaVersion: 1,
      description: 'Research tasks, not website implementation.',
      items: [{
        id: 'first-study',
        title: 'Run a study',
        question: 'Does the institution improve outcomes?',
        status: 'open',
        nextStep: 'Preregister a comparison.',
        sourceTitles: ['Research program and falsifiable hypotheses'],
      }],
    },
    sources: [{ id: 'S01' }],
    revision: { contentHash: '0123456789ab', builtAt: '2026-09-18T19:00:00.000Z', commit: null },
  };
}

test('presentation data derives plain text and links from the canonical source inputs', () => {
  const data = createPresentationData(input());
  assert.equal(data.project.title, 'Commons Collective');
  assert.equal(data.project.thesis, 'Shared agency.');
  assert.equal(data.sections[0].paragraphs[0], 'Original finding.');
  assert.equal(data.featured.questions, '16-research-program-and-falsifiable-hypotheses');
  assert.equal(data.workItems[0].sourceUrls[0], './index.html#16-research-program-and-falsifiable-hypotheses');
  assert.equal(data.demos[0].description, 'Ten proposed bargaining points.');
  assert.equal(data.sourceCount, 1);
});

test('changed research, questions, statuses, and added work appear without presentation edits', () => {
  const original = input();
  const before = createPresentationData(original);
  const updated = structuredClone(original);
  updated.report = updated.report.replace('Original **finding**.', 'A revised **finding**.');
  updated.work.items[0].question = 'A newly revised research question?';
  updated.work.items[0].status = 'done';
  updated.work.items.push({
    ...updated.work.items[0], id: 'second-study', title: 'A newly added study', status: 'open',
  });
  const after = createPresentationData(updated);
  assert.equal(before.sections[0].paragraphs[0], 'Original finding.');
  assert.equal(after.sections[0].paragraphs[0], 'A revised finding.');
  assert.equal(after.workItems[0].question, 'A newly revised research question?');
  assert.equal(after.workItems[0].status, 'done');
  assert.equal(after.workItems[1].title, 'A newly added study');
});

test('renumbered report sections update presentation and work-register source links', () => {
  const source = input();
  source.report = source.report.replace('## 16.', '## 17.');
  source.headings[2].id = '17-research-program-and-falsifiable-hypotheses';
  const data = createPresentationData(source);
  assert.equal(data.featured.questions, source.headings[2].id);
  assert.equal(data.workItems[0].sourceUrls[0], `./index.html#${source.headings[2].id}`);
});

test('invalid statuses and missing source sections fail instead of publishing stale substitutes', () => {
  const status = input();
  status.work.items[0].status = 'probably-done';
  assert.throws(() => createPresentationData(status), /Invalid open-work status/);
  const missing = input();
  missing.work.items[0].sourceTitles = ['A removed section'];
  assert.throws(() => createPresentationData(missing), /Unknown research source title/);
  const duplicate = input();
  duplicate.work.items.push(structuredClone(duplicate.work.items[0]));
  assert.throws(() => createPresentationData(duplicate), /duplicate open-work id/);
});

test('missing project text and ambiguous source titles fail explicitly', () => {
  const source = input();
  source.template = source.template.replace('class="deck"', 'class="removed"');
  assert.throws(() => createPresentationData(source), /missing project subtitle/);
  const ambiguous = input();
  ambiguous.report += '\n\n## 99. Research program and falsifiable hypotheses\n\nA conflicting source.';
  ambiguous.headings.push({ id: '99-research-program-and-falsifiable-hypotheses' });
  assert.throws(() => createPresentationData(ambiguous), /Ambiguous presentation source title/);
});

test('an empty work register remains empty rather than inventing work', () => {
  const source = input();
  source.work.items = [];
  assert.deepEqual(createPresentationData(source).workItems, []);
});

test('a changed companion-paper abstract flows into the live research browser without slide edits', () => {
  const source = input();
  const paper = '# A companion paper\n\nStatus: draft.\n\n## Abstract\n\nAn original conclusion. [S01]\n\n## Method\n\nDetails.';
  const descriptor = { id: 'paper-example', url: './blueprint.html#abstract' };
  source.additionalSections = [createCompanionSection(paper, descriptor)];
  const before = createPresentationData(source);
  source.additionalSections = [createCompanionSection(paper.replace('original', 'revised'), descriptor)];
  const after = createPresentationData(source);
  assert.equal(before.sections.at(-1).paragraphs[0], 'An original conclusion.');
  assert.equal(after.sections.at(-1).paragraphs[0], 'An revised conclusion.');
  assert.equal(after.sections.at(-1).url, './blueprint.html#abstract');
  assert.match(after.sections.at(-1).title, /Companion paper/);
});

test('missing companion abstracts and duplicate source identities fail explicitly', () => {
  assert.throws(() => createCompanionSection('# Missing abstract', { id: 'paper', url: './paper.html' }), /nonempty abstract/);
  const source = input();
  source.additionalSections = [{ id: 'abstract', title: 'Duplicate', url: './paper.html', paragraphs: ['A claim.'] }];
  assert.throws(() => createPresentationData(source), /Duplicate presentation source id/);
});
