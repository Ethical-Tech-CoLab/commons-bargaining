import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublications, publicationLink, assertNoRepositoryOnlyReferences } from '../scripts/publications.mjs';

const manifest = {
  schemaVersion: 1,
  public: [
    { id: 'paper', source: 'papers/paper.md', output: 'paper.html', title: 'Paper' },
    { id: 'example', source: 'papers/example.md', output: 'example.html', title: 'Example' },
  ],
  repositoryOnly: [{ source: 'papers/funding-proposal-draft.md', reason: 'Not for website publication' }],
};

test('publications are explicitly allowlisted and repository-only drafts cannot be promoted implicitly', () => {
  assert.equal(validatePublications(manifest), manifest);
  const bad = structuredClone(manifest);
  bad.public.push({ id: 'funding', source: 'papers/funding-proposal-draft.md', output: 'funding.html', title: 'Funding' });
  assert.throws(() => validatePublications(bad), /cannot be published/);
});

test('source-relative links resolve to published pages and local examples', () => {
  assert.equal(publicationLink('example.md', 'papers/paper.md', manifest), './example.html');
  assert.equal(publicationLink('../examples/component-passport.json', 'papers/paper.md', manifest), './component-passport.json');
  assert.equal(publicationLink('#abstract', 'papers/paper.md', manifest), '#abstract');
});

test('both local and repository URLs to the unlisted proposal are rejected', () => {
  assert.throws(() => publicationLink('funding-proposal-draft.md', 'papers/paper.md', manifest), /repository-only/);
  assert.throws(() => publicationLink('https://github.com/example/repo/blob/main/papers/funding-proposal-draft.md', 'papers/paper.md', manifest), /repository-only/);
  assert.throws(() => assertNoRepositoryOnlyReferences('A link to papers/funding-proposal-draft.md', manifest), /leaked/);
});
