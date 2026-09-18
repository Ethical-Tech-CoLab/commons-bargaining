import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSlideModel,
  fetchPresentationData,
  PresentationDataError,
  refreshViewState,
  safeSourceUrl,
  sourceExcerpt,
  validatePresentationData,
} from '../site/presentation-model.mjs';

const baseUrl = 'https://commons.example/project/overview.html';

function payload() {
  return {
    schemaVersion: 1,
    project: { title: 'A source project', subtitle: 'A source question?', thesis: 'A source proposition.', status: 'Draft', reportUrl: './index.html#report' },
    revision: { contentHash: 'abcdef0123456789', builtAt: '2026-09-18T19:00:00.000Z', commit: null },
    sections: [
      { id: 'abstract', title: 'Abstract from source', url: './index.html#abstract', paragraphs: ['A source abstract.'] },
      { id: 'approach', title: 'Approach from source', url: './index.html#approach', paragraphs: ['A source approach.'] },
      { id: 'questions', title: 'Questions from source', url: './index.html#questions', paragraphs: ['A source research question.'] },
      { id: 'next', title: 'Sequence from source', url: './index.html#next', paragraphs: ['A source next step.'] },
    ],
    featured: { abstract: 'abstract', approach: 'approach', questions: 'questions', nextSteps: 'next' },
    demos: [{ id: 'demo', title: 'Source demo', description: 'Description from source.', url: './demo.html', imageUrl: './demo.svg' }],
    workItems: [{ id: 'study', title: 'Source study', question: 'Does it work?', status: 'open', nextStep: 'Run a test.', sourceIds: ['questions'], sourceUrls: ['./index.html#questions'] }],
    sourceCount: 42,
    workUrl: './open-work.html',
  };
}

test('slides derive project, source excerpts, demos, and work from the published data', () => {
  const data = payload();
  const model = createSlideModel(data, baseUrl);
  assert.equal(model.slides.length, 6);
  assert.equal(model.slides[0].title, data.project.title);
  assert.equal(model.slides[1].title, data.sections[1].title);
  assert.deepEqual(model.slides[2].section.paragraphs, data.sections[2].paragraphs);
  assert.equal(model.slides[3].demos[0].description, data.demos[0].description);
  assert.equal(model.slides[4].items[0].question, 'Does it work?');
  assert.equal(model.slides[5].section.title, data.sections[3].title);
  assert.deepEqual(model.counts, { open: 1, 'in-progress': 0, blocked: 0, done: 0, total: 1, active: 1 });
  assert.equal(model.sourceCount, 42);
});

test('changed question and added work item appear without changing presentation code', () => {
  const data = payload();
  const initial = createSlideModel(data, baseUrl);
  data.workItems[0].question = 'A revised question from the canonical register?';
  data.workItems[0].status = 'done';
  data.workItems.push({ ...data.workItems[0], id: 'follow-up', title: 'A newly recorded study', status: 'blocked', nextStep: 'Resolve the dependency.' });
  data.sections[2].paragraphs.push('A new source paragraph.');
  const updated = createSlideModel(data, baseUrl);
  assert.equal(initial.slides[4].items[0].question, 'Does it work?');
  assert.equal(updated.slides[4].items[0].question, data.workItems[0].question);
  assert.equal(updated.slides[4].items[1].title, 'A newly recorded study');
  assert.equal(updated.slides[5].items[0].nextStep, 'Resolve the dependency.');
  assert.deepEqual(updated.counts, { open: 0, 'in-progress': 0, blocked: 1, done: 1, total: 2, active: 1 });
  assert.equal(updated.slides[2].section.paragraphs.at(-1), 'A new source paragraph.');
});

test('section IDs and titles may change without hard-coded featured lookups', () => {
  const data = payload();
  data.sections[1].id = 'renumbered-institution';
  data.sections[1].title = 'New source heading';
  data.sections[1].url = './index.html#renumbered-institution';
  data.featured.approach = 'renumbered-institution';
  const model = createSlideModel(data, baseUrl);
  assert.equal(model.slides[1].title, 'New source heading');
  assert.equal(model.slides[1].section.url, 'https://commons.example/project/index.html#renumbered-institution');
});

test('new report sections and linked work automatically enter the research and work browsers', () => {
  const data = payload();
  data.sections.push({
    id: 'new-institution',
    title: 'A newly published institution',
    url: './index.html#new-institution',
    paragraphs: ['New institutional research from the canonical report.'],
  });
  data.workItems.push({
    id: 'institution-study',
    title: 'Evaluate the new institution',
    question: 'A newly published institution question?',
    nextStep: 'Test its recorded assumptions.',
    status: 'in-progress',
    sourceIds: ['new-institution'],
    sourceUrls: ['./index.html#new-institution'],
  });
  const updated = createSlideModel(data, baseUrl);
  assert.equal(updated.slides[2].sections.length, 5);
  assert.equal(updated.slides[2].sections.at(-1).title, 'A newly published institution');
  assert.equal(updated.sectionById.get('new-institution').paragraphs[0], data.sections.at(-1).paragraphs[0]);
  assert.equal(updated.slides[4].items.at(-1).question, 'A newly published institution question?');
  assert.equal(updated.slides[5].items.at(-1).nextStep, 'Test its recorded assumptions.');
  assert.equal(updated.counts['in-progress'], 1);
  assert.equal(updated.counts.total, 2);
});

test('empty registers are displayed as empty without invented work or demos', () => {
  const data = payload();
  data.workItems = [];
  data.demos = [];
  data.sections[1].paragraphs = [];
  const model = createSlideModel(data, baseUrl);
  assert.equal(model.counts.total, 0);
  assert.deepEqual(model.slides[4].items, []);
  assert.deepEqual(model.slides[5].items, []);
  assert.deepEqual(model.slides[3].demos, []);
  assert.deepEqual(sourceExcerpt(model.slides[1].section), { text: '', shortened: false });
});

test('source excerpt is literal and explicitly identifies shortening', () => {
  const section = { paragraphs: ['An unchanged source passage.'] };
  assert.deepEqual(sourceExcerpt(section), { text: section.paragraphs[0], shortened: false });
  const long = { paragraphs: ['A source sentence. '.repeat(100)] };
  const excerpt = sourceExcerpt(long, 80);
  assert.equal(excerpt.shortened, true);
  assert.ok(excerpt.text.length <= 81);
  assert.ok(long.paragraphs[0].startsWith(excerpt.text.slice(0, -1)));
  assert.ok(excerpt.text.endsWith('…'));
});

test('schema errors and broken source relationships fail explicitly', () => {
  const mutations = [
    (data) => { data.schemaVersion = 2; },
    (data) => { delete data.project.title; },
    (data) => { data.sections = null; },
    (data) => { data.sections[0].paragraphs = ['']; },
    (data) => { data.sections[0].paragraphs = [{ html: '<script>' }]; },
    (data) => { data.featured.questions = 'missing'; },
    (data) => { data.sourceCount = -1; },
    (data) => { data.sourceCount = 2.5; },
    (data) => { data.revision.builtAt = 'not a date'; },
    (data) => { data.revision.commit = false; },
    (data) => { data.workItems[0].status = 'maybe'; },
    (data) => { data.workItems[0].sourceIds = ['unknown']; },
    (data) => { data.workItems[0].sourceUrls = []; },
    (data) => { data.workItems[0].sourceUrls = ['./index.html#abstract']; },
    (data) => { data.workItems.push({ ...data.workItems[0] }); },
    (data) => { data.sections.push({ ...data.sections[0] }); },
    (data) => { data.demos.push({ ...data.demos[0] }); },
  ];
  for (const mutate of mutations) {
    const data = payload();
    mutate(data);
    assert.throws(() => validatePresentationData(data, baseUrl), PresentationDataError);
  }
  for (const data of [null, [], 'data']) assert.throws(() => validatePresentationData(data, baseUrl), PresentationDataError);
});

test('safe source URLs preserve same-origin links and reject executable or external URLs', () => {
  assert.equal(safeSourceUrl('./index.html#abstract', baseUrl), 'https://commons.example/project/index.html#abstract');
  assert.equal(safeSourceUrl('/report.html', baseUrl), 'https://commons.example/report.html');
  assert.equal(safeSourceUrl('https://commons.example/report.html', baseUrl), 'https://commons.example/report.html');
  for (const value of [
    'https://external.example/research', '//external.example/research',
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'file:///C:/data.txt', 'http://commons.example/report.html',
    'https://user:password@commons.example/report.html',
    '\\\\external.example\\research', '\njavascript:alert(1)', '',
  ]) assert.throws(() => safeSourceUrl(value, baseUrl), PresentationDataError);
});

test('every URL-bearing payload field is validated', () => {
  for (const mutate of [
    (data) => { data.project.reportUrl = 'javascript:alert(1)'; },
    (data) => { data.sections[0].url = 'https://outside.example/'; },
    (data) => { data.workUrl = 'https://outside.example/'; },
    (data) => { data.workItems[0].sourceUrls[0] = 'https://outside.example/'; },
    (data) => { data.demos[0].url = 'https://outside.example/'; },
    (data) => { data.demos[0].imageUrl = 'https://outside.example/tracker.svg'; },
  ]) {
    const data = payload();
    mutate(data);
    assert.throws(() => createSlideModel(data, baseUrl), PresentationDataError);
  }
});

test('loading revalidates with no-store and a timestamp and validates the response', async () => {
  let request;
  const controller = new AbortController();
  const result = await fetchPresentationData({
    baseUrl,
    timestamp: 123456,
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => payload() };
    },
  });
  assert.equal(request.url, 'https://commons.example/project/presentation-data.json?_=123456');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.signal, controller.signal);
  assert.equal(result.counts.open, 1);
});

test('non-success HTTP responses reject instead of returning data or silently using a fallback', async () => {
  for (const status of [404, 429, 500, 503]) {
    await assert.rejects(fetchPresentationData({
      baseUrl,
      fetchImpl: async () => ({ ok: false, status, json: async () => assert.fail('Error response must not be parsed as a successful publication') }),
    }), new RegExp(`HTTP ${status}`));
  }
});

test('failed refresh explicitly hides previously current content and permits retry', async () => {
  const checkedAt = new Date('2026-09-18T19:00:00.000Z');
  let state = refreshViewState('current', { checkedAt });
  assert.equal(state.showDeck, true);
  state = refreshViewState('loading', { checkedAt });
  assert.equal(state.showDeck, false);
  assert.equal(state.isBusy, true);
  try {
    await fetchPresentationData({
      baseUrl,
      fetchImpl: async () => ({ ok: false, status: 503 }),
    });
    assert.fail('The refresh should have failed.');
  } catch (error) {
    state = refreshViewState('error', { checkedAt, error });
  }
  assert.equal(state.showDeck, false, 'Earlier content must not remain visible as current');
  assert.equal(state.showError, true);
  assert.equal(state.isBusy, false, 'Retry controls must not remain busy');
  assert.match(state.status, /Refresh failed.*unverified/);
  assert.match(state.errorMessage, /HTTP 503/);

  const recovered = await fetchPresentationData({
    baseUrl,
    fetchImpl: async () => ({ ok: true, json: async () => payload() }),
  });
  assert.equal(recovered.counts.total, 1);
  state = refreshViewState('current', { checkedAt: new Date('2026-09-18T19:01:00.000Z') });
  assert.equal(state.showDeck, true);
  assert.equal(state.showError, false);
  assert.equal(state.errorMessage, '');
});

test('timeout and initial failure are explicit without any prior successful revision', () => {
  const timeout = refreshViewState('error', { error: { name: 'AbortError' } });
  assert.equal(timeout.showDeck, false);
  assert.equal(timeout.showError, true);
  assert.match(timeout.errorMessage, /timed out.*retry/i);
  const initialFailure = refreshViewState('error');
  assert.equal(initialFailure.showDeck, false);
  assert.match(initialFailure.status, /unverified/);
  assert.throws(() => refreshViewState('current'), /check time/);
});

test('invalid JSON, invalid schema, and network failures reject', async () => {
  await assert.rejects(fetchPresentationData({
    baseUrl,
    fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } }),
  }), /invalid JSON/);
  await assert.rejects(fetchPresentationData({
    baseUrl,
    fetchImpl: async () => ({ ok: true, json: async () => ({ schemaVersion: 99 }) }),
  }), /schema/);
  await assert.rejects(fetchPresentationData({
    baseUrl,
    fetchImpl: async () => { throw new TypeError('Network unavailable'); },
  }), /Network unavailable/);
});

test('timeouts while reading the response retain their identity for the refresh error state', async () => {
  const timeout = new Error('Body read aborted');
  timeout.name = 'AbortError';
  await assert.rejects(fetchPresentationData({
    baseUrl,
    fetchImpl: async () => ({ ok: true, json: async () => { throw timeout; } }),
  }), error => {
    assert.equal(error, timeout);
    assert.match(refreshViewState('error', { error }).errorMessage, /timed out/);
    return true;
  });
});
