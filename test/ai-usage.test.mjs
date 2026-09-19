import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateUsageAudit, renderUsageAudit, usageAuditSection } from '../scripts/usage-audit.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const data = await readJson('../usage/ai-usage.json');
const config = await readJson('../usage/audit-config.json');
const upstream = await readJson('../vendor/usage-calc/UPSTREAM.json');
const adapterSha256 = createHash('sha256').update(
  (await readFile(new URL('../scripts/capture-ai-usage.py', import.meta.url), 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'),
).digest('hex');

test('published usage reconciles by model, role, channel, day, and observed rate', () => {
  assert.equal(validateUsageAudit(data, config, upstream, adapterSha256), data);
  assert.equal(data.models.length, 1);
  assert.equal(data.models[0].model, 'gpt-6-astra');
  assert.equal(data.totals.requests, 401);
  assert.equal(data.totals.nanoAiu, '16486140250000');
  assert.equal(data.totals.listPriceUsdExact, '164.8614025');
  assert.equal(data.totals.embeddedAgentCount, 7);
});

test('scope and privacy fields are enforced, not just asserted in prose', () => {
  const changes = [
    copy => { copy.prompt = 'private'; },
    copy => { copy.scope.cwd = 'private'; },
    copy => { copy.models[0].messages = []; },
    copy => { copy.privacy.containsPrompts = true; },
    copy => { copy.scope.cutoffExclusive = '2030-01-01T00:00:00Z'; },
    copy => { copy.upstream.commit = '0'.repeat(40); },
    copy => { copy.models[0].model = 'unreviewed-model'; },
  ];
  for (const change of changes) {
    const copy = structuredClone(data);
    change(copy);
    assert.throws(() => validateUsageAudit(copy, config, upstream, adapterSha256), /AI usage audit/);
  }
});

test('inconsistent numbers and billing claims fail publication', () => {
  const changes = [
    copy => { copy.models[0].requests += 1; },
    copy => { copy.roles[0].tokens.input += 1; },
    copy => { copy.rates[0].nanoAiu = '0'; },
    copy => { copy.rates[0].usdPerMillionTokensExact = '999'; },
    copy => { copy.channels[0].listPriceUsdExact = '0'; },
    copy => { copy.totals.requestActiveUnionMs = copy.totals.modelWorkMs + 1; },
    copy => { copy.pricing.invoiceMeasured = true; },
    copy => { copy.coverage.allSelectedChargesReconciled = false; },
    copy => {
      [copy.roles[0].role, copy.roles[1].role] = [copy.roles[1].role, copy.roles[0].role];
    },
  ];
  for (const change of changes) {
    const copy = structuredClone(data);
    change(copy);
    assert.throws(() => validateUsageAudit(copy, config, upstream, adapterSha256), /AI usage audit/);
  }
  assert.throws(() => validateUsageAudit(data, { ...config, dbPath: 'private' }, upstream, adapterSha256), /unapproved fields/);
  assert.throws(() => validateUsageAudit(data, config, upstream, '0'.repeat(64)), /adapter changed/);
});

test('vendored calculation modules match the pinned normalized source hashes', async () => {
  for (const [path, expected] of Object.entries(upstream.files)) {
    const content = (await readFile(new URL(`../vendor/usage-calc/${path}`, import.meta.url), 'utf8'))
      .replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(content).digest('hex'), expected, path);
  }
});

test('the actual Python collector passes scoped synthetic-ledger privacy and reconciliation checks', () => {
  const result = spawnSync('python', [fileURLToPath(new URL('./usage-capture-fixture.py', import.meta.url))], {
    encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.error, undefined, 'Python 3 is required for the audit collector checks');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Synthetic audit checks passed/);
});

test('the audit page and live overview explain the measurement boundaries', () => {
  const html = renderUsageAudit(data);
  assert.match(html, /gpt-6-astra/);
  assert.match(html, /401/);
  assert.match(html, /\$164\.86/);
  assert.match(html, /not a bill/);
  assert.match(html, /unrounded/);
  assert.match(html, /does not independently establish the model weights/);
  assert.match(html, /No prompt text/);
  const section = usageAuditSection(data);
  assert.equal(section.url, './ai-usage.html#usage-summary');
  assert.ok(section.paragraphs.join(' ').includes('not an invoice'));
  const changed = structuredClone(data);
  changed.totals.requests = 402;
  assert.ok(usageAuditSection(changed).paragraphs[0].includes('402'));
});
