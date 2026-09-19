import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { validatePublications, assertNoRepositoryOnlyReferences } from '../scripts/publications.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const manifest = validatePublications(JSON.parse(await read('research/publications.json')));
const registry = [
  ...JSON.parse(await read('research/sources.json')),
  ...JSON.parse(await read('research/replication-sources.json')),
];
const sourceIds = new Set(registry.map(source => source.id));

test('the two public first drafts are standalone, bounded, and source-referenced', async () => {
  for (const file of ['papers/commons-collective-paper-draft.md', 'papers/institutional-blueprint-example.md']) {
    const text = await read(file);
    assert.match(text, /^# Commons Collective/);
    assert.match(text, /## Abstract/);
    assert.match(text, /## (References|Bibliography)/);
    assert.match(text, /not peer-reviewed/i);
    assert.match(text, /AI-assisted/);
    assert.match(text, /CC BY 4\.0/);
    const body = text.split(/^## (?:References|Bibliography)/m)[0];
    const words = body.trim().split(/\s+/u).length;
    assert.ok(words >= 1800 && words <= 2700, `${file}: ${words} words before references`);
    for (const [, id] of text.matchAll(/\[(S\d{2})\]/g)) {
      assert.ok(sourceIds.has(id), `unknown source ${id} in ${file}`);
    }
    assertNoRepositoryOnlyReferences(text, manifest);
  }
});

test('the institutional example keeps its conditions and accounting boundaries', async () => {
  const text = await read('papers/institutional-blueprint-example.md');
  for (const term of ['not incorporated', 'New York', 'not market quotes', '$660,000', '$300,000',
    '$240,000', '$60,000', '$90,000 reserve gap', 'not revenue', 'not-reviewed']) {
    assert.ok(text.includes(term), `missing institutional-example boundary ${term}`);
  }
});

test('funding draft is repository-only and its seven budget rows sum to the proposed ask', async () => {
  const text = await read('papers/funding-proposal-draft.md');
  assert.match(text, /Repository-only draft; not published as a website document; not submitted/);
  assert.match(text, /not confidential/);
  assert.match(text, /TO CONFIRM/);
  assert.match(text, /not an implemented or funded organization/);
  const rows = [...text.matchAll(/^\| (?!\*\*Total)([^|]+) \| \$([\d,]+) \|/gm)];
  assert.equal(rows.length, 7);
  assert.equal(rows.reduce((sum, row) => sum + Number(row[2].replaceAll(',', '')), 0), 750000);
  assert.match(text, /24 months/);
  assert.match(text, /recheck live eligibility/);
  assert.ok(!manifest.public.some(item => item.source === 'papers/funding-proposal-draft.md'));
});

test('public draft pages and their abstracts are included in the live source view', async () => {
  const data = JSON.parse(await read('dist/presentation-data.json'));
  for (const entry of manifest.public) {
    await access(new URL(`dist/${entry.output}`, root));
    await access(new URL(`dist/${entry.source}`, root));
    assert.ok(data.sections.some(section => section.id === entry.id && section.url === `./${entry.output}#abstract`));
  }
});

test('repository-only draft is neither linked nor copied into website output', async () => {
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await inspect(path);
      else {
        assert.ok(!entry.name.startsWith('funding-proposal-draft.'), 'repository-only file in dist');
        if (/\.(html|json|md|mjs|css)$/i.test(entry.name)) {
          assertNoRepositoryOnlyReferences(await readFile(path, 'utf8'), manifest);
        }
      }
    }
  }
  await inspect(new URL('dist/', root));
});
