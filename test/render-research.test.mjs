import test from 'node:test';
import assert from 'node:assert/strict';
import { renderResearch } from '../scripts/render-research.mjs';

test('research documents have independent navigation and citation sets', () => {
  const ids = new Set(['S01', 'S70']);
  const first = renderResearch('## First\n\nA claim. [S01]', ids);
  const second = renderResearch('## Second\n\nAnother claim. [S70]', ids, { citationPrefix: './index.html#ref-' });
  assert.deepEqual(first.headings.map(item => item.id), ['first']);
  assert.deepEqual(second.headings.map(item => item.id), ['second']);
  assert.deepEqual([...first.cited], ['S01']);
  assert.deepEqual([...second.cited], ['S70']);
  assert.match(first.html, /href="#ref-S01"/);
  assert.match(second.html, /href="\.\/index\.html#ref-S70"/);
});

test('companion-paper links can be resolved without changing ordinary report links', () => {
  const markdown = '[Charter](../templates/collective-charter.md)';
  const report = renderResearch(markdown, new Set());
  const paper = renderResearch(markdown, new Set(), {
    resolveLink: href => href.replace('../templates/', './templates/'),
  });
  assert.match(report.html, /\.\.\/templates\/collective-charter\.md/);
  assert.match(paper.html, /\.\/templates\/collective-charter\.md/);
});

test('unknown citations fail and accessible table wrappers are retained', () => {
  assert.throws(() => renderResearch('[S99]', new Set()), /Unknown citation/);
  const result = renderResearch('| Layer | Test |\n|---|---|\n| Mandate | Verify authority |', new Set());
  assert.match(result.html, /role="region" aria-label="Research comparison table"/);
  assert.match(result.html, /<table>/);
});
