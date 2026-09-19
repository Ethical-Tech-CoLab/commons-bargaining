const CHANNELS = ['input', 'cache_read', 'cache_write', 'output'];
const AGGREGATE = ['requests', 'tokens', 'pricedTokens', 'reasoningMetadataTokens', 'nanoAiu', 'listPriceUsdExact', 'modelWorkMs'];
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const number = value => value.toLocaleString('en-US');
const dollars = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
const hours = value => (value / 3_600_000).toFixed(2);
const channelName = value => ({ input: 'Input channel', cache_read: 'Cache read', cache_write: 'Cache write', output: 'Output channel' })[value];
const roleName = value => ({ 'main-assistant': 'Main assistant', 'delegated-agents': 'Delegated agents' })[value];

function requireValue(condition, message) {
  if (!condition) throw new Error(`AI usage audit: ${message}`);
}

function keys(value, allowed, name) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  const actual = Object.keys(value).sort();
  requireValue(JSON.stringify(actual) === JSON.stringify([...allowed].sort()), `${name} has missing or unapproved fields`);
}

function count(value, name) {
  requireValue(Number.isSafeInteger(value) && value >= 0, `${name} must be a nonnegative safe integer`);
}

function nano(value) {
  requireValue(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value), 'charge units must be decimal integer strings');
  return BigInt(value);
}

function decimalUnits(value, scale) {
  requireValue(typeof value === 'string' && /^\d+(\.\d+)?$/.test(value), 'invalid exact decimal');
  const [whole, fraction = ''] = value.split('.');
  requireValue(fraction.length <= scale, 'decimal precision exceeds the declared unit conversion');
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'));
}

function charge(row) {
  requireValue(nano(row.nanoAiu) === decimalUnits(row.listPriceUsdExact, 11), 'USD equivalent does not reconcile to nano-AIU');
  requireValue(Number.isFinite(Number(row.listPriceUsdExact)), 'displayed currency is outside supported range');
}

function aggregate(row, extra = []) {
  keys(row, [...AGGREGATE, ...extra], 'aggregate row');
  keys(row.tokens, CHANNELS, 'token channels');
  for (const key of ['requests', 'pricedTokens', 'reasoningMetadataTokens', 'modelWorkMs']) count(row[key], key);
  for (const key of CHANNELS) count(row.tokens[key], key);
  requireValue(CHANNELS.reduce((sum, key) => sum + row.tokens[key], 0) === row.pricedTokens, 'token-channel sum differs');
  charge(row);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateUsageAudit(data, config, upstream, adapterSha256) {
  keys(config, ['schemaVersion', 'project', 'repository', 'materialCommit', 'cutoffExclusive',
    'cutoffReason', 'scopePolicy', 'approvedModels'], 'public capture configuration');
  requireValue(config.schemaVersion === 1 && Array.isArray(config.approvedModels)
    && config.approvedModels.length > 0 && config.approvedModels.every(model =>
      typeof model === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model)), 'invalid reviewed model allowlist');
  requireValue(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository),
    'project repository must be a public GitHub URL without credentials or query parameters');
  keys(data, ['schemaVersion', 'project', 'repository', 'generatedAt', 'scope', 'upstream', 'pricing',
    'coverage', 'integrity', 'totals', 'models', 'roles', 'modelRoles', 'channels', 'rates',
    'days', 'dayBoundary', 'privacy', 'limitations'], 'public payload');
  requireValue(data.schemaVersion === 1, 'unsupported schema');
  requireValue(data.project === config.project && data.repository === config.repository, 'project does not match capture configuration');
  keys(data.scope, ['policy', 'cutoffExclusive', 'cutoffReason', 'materialCommit', 'machinesObserved',
    'matchingSessions', 'sessionsWithIncludedUsage', 'matchingSessionsWithoutIncludedUsage', 'sessionFingerprints',
    'firstRecordedAt', 'lastRecordedAt', 'excludedRowsAtOrAfterCutoff', 'otherMachinesVerified'], 'scope');
  requireValue(data.scope.cutoffExclusive === config.cutoffExclusive && data.scope.materialCommit === config.materialCommit,
    'audit boundary differs from configuration');
  requireValue(/^[a-f0-9]{40}$/.test(data.scope.materialCommit), 'invalid material revision');
  for (const value of [data.generatedAt, data.scope.cutoffExclusive, data.scope.firstRecordedAt, data.scope.lastRecordedAt]) {
    requireValue(typeof value === 'string' && value.endsWith('Z') && Number.isFinite(Date.parse(value)), 'timestamps must be valid UTC values');
  }
  requireValue(Date.parse(data.scope.firstRecordedAt) <= Date.parse(data.scope.lastRecordedAt), 'inverted time coverage');
  requireValue(Date.parse(data.scope.lastRecordedAt) < Date.parse(data.scope.cutoffExclusive), 'usage extends past the declared cutoff');
  requireValue(Date.parse(data.generatedAt) >= Date.parse(data.scope.cutoffExclusive), 'capture precedes its audit cutoff');
  for (const key of ['machinesObserved', 'matchingSessions', 'sessionsWithIncludedUsage', 'matchingSessionsWithoutIncludedUsage', 'excludedRowsAtOrAfterCutoff']) count(data.scope[key], key);
  requireValue(data.scope.machinesObserved === 1 && data.scope.otherMachinesVerified === false, 'unsupported cross-machine coverage');
  requireValue(data.scope.sessionsWithIncludedUsage + data.scope.matchingSessionsWithoutIncludedUsage === data.scope.matchingSessions,
    'session coverage does not reconcile');
  requireValue(Array.isArray(data.scope.sessionFingerprints)
    && data.scope.sessionFingerprints.length === data.scope.sessionsWithIncludedUsage
    && data.scope.sessionFingerprints.every(value => /^[a-f0-9]{64}$/.test(value)), 'invalid anonymized session references');
  keys(data.upstream, ['name', 'repository', 'commit', 'version', 'functions'], 'upstream provenance');
  requireValue(upstream.repository === 'https://github.com/Ethical-Tech-CoLab/usage-calc'
    && /^[a-f0-9]{40}$/.test(upstream.commit), 'invalid upstream reference');
  requireValue(data.upstream.repository === upstream.repository && data.upstream.commit === upstream.commit
    && data.upstream.version === upstream.version, 'calculation version is not pinned to the vendored source');
  requireValue(JSON.stringify(data.upstream.functions) === JSON.stringify([
    'store.load_events(strict=True)', 'metrics.group', 'intervals.busy_union',
  ]), 'unexpected upstream calculation path');
  keys(data.pricing, ['nanoAiuPerCredit', 'assumedUsdPerCredit', 'invoiceMeasured', 'interpretation'], 'pricing');
  requireValue(data.pricing.nanoAiuPerCredit === '1000000000' && data.pricing.assumedUsdPerCredit === '0.01'
    && data.pricing.invoiceMeasured === false, 'unsupported conversion or invoice claim');
  keys(data.coverage, ['includedRows', 'rowsWithTokenDetails', 'rowsWithRecordedDuration', 'rowsWithReasoningMetadata',
    'rowsWithNonzeroReasoningMetadata', 'rowsWithFlatTokenColumnDifferences', 'allSelectedChargesReconciled'], 'coverage');
  requireValue(data.coverage.allSelectedChargesReconciled === true, 'unreconciled records cannot be published');
  aggregate(data.totals, ['requestActiveUnionMs', 'busyBlocks', 'embeddedAgentCount']);
  requireValue(data.totals.requests > 0, 'no measured requests');
  for (const [key, value] of Object.entries(data.coverage)) {
    if (key === 'allSelectedChargesReconciled') continue;
    count(value, key);
    requireValue(value <= data.totals.requests, 'coverage exceeds request count');
  }
  requireValue(data.coverage.includedRows === data.totals.requests
    && data.coverage.rowsWithTokenDetails === data.totals.requests
    && data.coverage.rowsWithRecordedDuration === data.totals.requests, 'required fields are not complete');
  requireValue(data.coverage.rowsWithNonzeroReasoningMetadata <= data.coverage.rowsWithReasoningMetadata, 'invalid reasoning coverage');
  for (const key of ['requestActiveUnionMs', 'busyBlocks', 'embeddedAgentCount']) count(data.totals[key], key);
  requireValue(data.totals.requestActiveUnionMs <= data.totals.modelWorkMs, 'union exceeds summed request time');
  keys(data.integrity, ['sourceUsageRecordsSha256', 'captureAdapterSha256', 'captureConfigSha256', 'note'], 'integrity');
  requireValue(/^[a-f0-9]{64}$/.test(data.integrity.sourceUsageRecordsSha256), 'invalid source-data digest');
  requireValue(/^[a-f0-9]{64}$/.test(adapterSha256) && data.integrity.captureAdapterSha256 === adapterSha256,
    'capture adapter changed; recapture and review the snapshot');
  requireValue(data.integrity.captureConfigSha256 === createHash('sha256').update(canonicalJson(config)).digest('hex'),
    'capture configuration digest differs');
  keys(data.privacy, ['containsPrompts', 'containsResponses', 'containsTurnLabels', 'containsPaths',
    'containsMachineNames', 'containsRawSessionIds', 'containsRawAgentIds', 'containsIndividualRequestRows'], 'privacy');
  requireValue(Object.values(data.privacy).every(value => value === false), 'public artifact includes disallowed private data');

  const modelIds = new Set();
  for (const row of data.models) {
    aggregate(row, ['model']);
    requireValue(config.approvedModels.includes(row.model) && !modelIds.has(row.model), 'unapproved or duplicate model');
    modelIds.add(row.model);
  }
  for (const [name, fields] of [['roles', ['role']], ['modelRoles', ['model', 'role']], ['days', ['date']]]) {
    requireValue(Array.isArray(data[name]) && data[name].length > 0, `missing ${name}`);
    const unique = new Set();
    for (const row of data[name]) {
      aggregate(row, fields);
      if (fields.includes('role')) requireValue(Boolean(roleName(row.role)), 'unknown request role');
      if (fields.includes('model')) requireValue(modelIds.has(row.model), 'unknown model in role breakdown');
      if (fields.includes('date')) requireValue(/^\d{4}-\d{2}-\d{2}$/.test(row.date), 'invalid UTC day');
      if (fields.includes('date')) requireValue(row.date >= data.scope.firstRecordedAt.slice(0, 10)
        && row.date <= data.scope.lastRecordedAt.slice(0, 10), 'daily row is outside the recorded window');
      const id = fields.map(field => row[field]).join('\0');
      requireValue(!unique.has(id), `duplicate ${name} row`);
      unique.add(id);
    }
  }
  for (const rows of [data.models, data.roles, data.modelRoles, data.days]) {
    requireValue(rows.reduce((sum, row) => sum + row.requests, 0) === data.totals.requests, 'grouped request totals differ');
    requireValue(rows.reduce((sum, row) => sum + nano(row.nanoAiu), 0n) === nano(data.totals.nanoAiu), 'grouped charges differ');
    requireValue(rows.reduce((sum, row) => sum + row.modelWorkMs, 0) === data.totals.modelWorkMs, 'grouped work time differs');
    requireValue(rows.reduce((sum, row) => sum + row.reasoningMetadataTokens, 0) === data.totals.reasoningMetadataTokens,
      'grouped reasoning metadata differs');
    for (const channel of CHANNELS) {
      requireValue(rows.reduce((sum, row) => sum + row.tokens[channel], 0) === data.totals.tokens[channel], 'grouped channel totals differ');
    }
  }
  requireValue(data.channels.length === CHANNELS.length
    && new Set(data.channels.map(row => row.channel)).size === CHANNELS.length, 'invalid channel inventory');
  for (const row of data.channels) {
    keys(row, ['channel', 'tokens', 'nanoAiu', 'listPriceUsdExact'], 'channel');
    requireValue(CHANNELS.includes(row.channel) && row.tokens === data.totals.tokens[row.channel], 'channel traffic differs');
    charge(row);
  }
  requireValue(data.channels.reduce((sum, row) => sum + nano(row.nanoAiu), 0n) === nano(data.totals.nanoAiu), 'channel charges differ');
  const rateKeys = new Set();
  for (const row of data.rates) {
    keys(row, ['model', 'channel', 'nanoAiuPerToken', 'usdPerMillionTokensExact', 'tokens', 'requests', 'nanoAiu'], 'rate');
    requireValue(modelIds.has(row.model) && CHANNELS.includes(row.channel), 'unknown model/channel rate');
    count(row.tokens, 'rate tokens'); count(row.requests, 'rate requests');
    const key = [row.model, row.channel, row.nanoAiuPerToken].join('\0');
    requireValue(!rateKeys.has(key) && row.requests > 0, 'duplicate or empty rate group');
    rateKeys.add(key);
    requireValue(BigInt(row.tokens) * nano(row.nanoAiuPerToken) === nano(row.nanoAiu), 'rate extension does not reconcile');
    requireValue(nano(row.nanoAiuPerToken) === decimalUnits(row.usdPerMillionTokensExact, 5), 'rate conversion differs');
  }
  for (const model of data.models) {
    const rows = data.modelRoles.filter(row => row.model === model.model);
    requireValue(rows.reduce((sum, row) => sum + row.requests, 0) === model.requests
      && rows.reduce((sum, row) => sum + nano(row.nanoAiu), 0n) === nano(model.nanoAiu), 'model-role attribution differs');
    requireValue(rows.reduce((sum, row) => sum + row.modelWorkMs, 0) === model.modelWorkMs
      && rows.reduce((sum, row) => sum + row.reasoningMetadataTokens, 0) === model.reasoningMetadataTokens,
    'model-role time or reasoning metadata differs');
    const modelRates = data.rates.filter(row => row.model === model.model);
    requireValue(modelRates.reduce((sum, row) => sum + nano(row.nanoAiu), 0n) === nano(model.nanoAiu), 'rate costs differ by model');
    for (const channel of CHANNELS) {
      const rates = data.rates.filter(row => row.model === model.model && row.channel === channel);
      requireValue(rates.reduce((sum, row) => sum + row.tokens, 0) === model.tokens[channel], 'rate traffic does not match model channel');
      requireValue(rates.reduce((sum, row) => sum + row.requests, 0) <= model.requests, 'rate request coverage exceeds model requests');
      requireValue(rows.reduce((sum, row) => sum + row.tokens[channel], 0) === model.tokens[channel], 'model-role token attribution differs');
    }
  }
  for (const channel of data.channels) {
    requireValue(data.rates.filter(row => row.channel === channel.channel).reduce((sum, row) => sum + nano(row.nanoAiu), 0n)
      === nano(channel.nanoAiu), 'rate costs differ by channel');
  }
  for (const role of data.roles) {
    const rows = data.modelRoles.filter(row => row.role === role.role);
    requireValue(rows.reduce((sum, row) => sum + row.requests, 0) === role.requests
      && rows.reduce((sum, row) => sum + nano(row.nanoAiu), 0n) === nano(role.nanoAiu)
      && rows.reduce((sum, row) => sum + row.modelWorkMs, 0) === role.modelWorkMs,
    'model-role totals disagree with the role summary');
    for (const channel of CHANNELS) {
      requireValue(rows.reduce((sum, row) => sum + row.tokens[channel], 0) === role.tokens[channel],
        'model-role channels disagree with the role summary');
    }
  }
  requireValue(data.rates.reduce((sum, row) => sum + nano(row.nanoAiu), 0n) === nano(data.totals.nanoAiu), 'rate charges do not reconcile');
  requireValue(Array.isArray(data.limitations) && data.limitations.length >= 8
    && data.limitations.every(value => typeof value === 'string' && value.length > 15), 'missing audit limitations');
  return data;
}

function table(headers, rows, label) {
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(label)}"><table>
    <thead><tr>${headers.map(header => `<th scope="col">${escape(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function renderUsageAudit(data) {
  const total = data.totals;
  const scope = data.scope;
  const rateRows = [...data.rates].sort((a, b) => a.model.localeCompare(b.model)
    || CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel)
    || Number(nano(a.nanoAiuPerToken) - nano(b.nanoAiuPerToken)));
  const metrics = [
    ['Recorded requests', number(total.requests)],
    ['Recorded model IDs', number(data.models.length)],
    ['Embedded delegated agents', number(total.embeddedAgentCount)],
    ['Output-channel tokens', number(total.tokens.output)],
    ['USD equivalent / not a bill', dollars(total.listPriceUsdExact)],
    ['Request-active union', `${hours(total.requestActiveUnionMs)} h`],
  ];
  return `<section id="usage-summary" class="audit-summary">
    <p class="eyebrow">Recorded usage / bounded disclosure</p>
    <h1>AI usage audit.</h1>
    <p class="audit-lede">The local Copilot ledger behind Commons Collective, grouped by the model identifier actually recorded. Calculations reuse a pinned version of Ethical Tech CoLab's usage-calc.</p>
    <div class="audit-warning"><strong>A snapshot, not a bill or a live usage meter.</strong> Includes records before <time datetime="${escape(scope.cutoffExclusive)}">${escape(scope.cutoffExclusive)}</time> (UTC). ${escape(scope.cutoffReason)} Other machines and unlogged activity are not established by these records.</div>
    <dl class="audit-metrics">${metrics.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
    <nav class="audit-links" aria-label="Audit resources"><a href="./ai-usage.json" download>Download aggregate data</a><a href="./usage-method.md" download>Method and reproduction</a><a href="${escape(data.upstream.repository)}/tree/${escape(data.upstream.commit)}">Pinned usage-calc source</a></nav>
  </section>
  <section id="usage-models"><h2>By recorded model</h2>
    <p>${data.models.length === 1 ? `All included requests record the same model ID. ${total.embeddedAgentCount} delegated agents or multiple prices must not be mistaken for different model types.` : 'Model IDs are taken from the ledger, not inferred from agent names.'} The identifier does not independently establish the model weights, revision, or hidden provider routing.</p>
    ${table(['Model ID', 'Requests', 'Input', 'Cache read', 'Cache write', 'Output', 'USD equivalent', 'Summed request time'],
      data.models.map(row => [row.model, number(row.requests), number(row.tokens.input), number(row.tokens.cache_read),
        number(row.tokens.cache_write), number(row.tokens.output), dollars(row.listPriceUsdExact), `${hours(row.modelWorkMs)} h`]), 'Usage by recorded model')}
    <p class="audit-note">Token values come from price-bearing channel details. Cached traffic is repeated context, not unique authored material. Recorded reasoning metadata totals ${number(total.reasoningMetadataTokens)} tokens and is not added again to the ${number(total.pricedTokens)} priced-channel tokens.</p>
  </section>
  <section id="usage-roles"><h2>Main assistant and delegated work</h2>
    ${table(['Model ID', 'Role', 'Requests', 'Priced-channel tokens', 'USD equivalent', 'Summed request time'],
      data.modelRoles.map(row => [row.model, roleName(row.role), number(row.requests), number(row.pricedTokens),
        dollars(row.listPriceUsdExact), `${hours(row.modelWorkMs)} h`]), 'Main and delegated model usage')}
    <p class="audit-note">These are alternative breakdowns of the same total, not additional charges. Agent identities and task text are withheld. Summed request time is ${number(total.modelWorkMs)} ms (${hours(total.modelWorkMs)} hours); the overlap-aware union is ${number(total.requestActiveUnionMs)} ms (${hours(total.requestActiveUnionMs)} hours. Neither is measured human labor or GPU time. Displayed USD and hours are rounded; reconciliation uses integer charge units and milliseconds.</p>
  </section>
  <section id="usage-pricing"><h2>Channels and observed rates</h2>
    ${table(['Recorded channel', 'Tokens', 'USD equivalent (unrounded)'], data.channels.map(row => [channelName(row.channel), number(row.tokens), `$${row.listPriceUsdExact}`]), 'Token channel charges')}
    <details><summary>Inspect all observed model/channel rates</summary>
    ${table(['Model ID', 'Channel', 'USD equivalent / million tokens', 'Tokens at rate', 'Requests with rate'],
      rateRows.map(row => [row.model, channelName(row.channel), dollars(row.usdPerMillionTokensExact), number(row.tokens), number(row.requests)]), 'Observed ledger rates')}
    <p class="audit-note">Rates can vary within one model ID. No reason for the variation is inferred. A request can appear in several channel rows; do not add their request counts.</p></details>
    <p>${escape(data.pricing.interpretation)} The conversion assumes 1,000,000,000 nano-AIU per credit and USD 0.01 per credit. ${escape(total.nanoAiu)} recorded nano-AIU therefore converts to USD ${escape(total.listPriceUsdExact)} before display rounding. No invoice, subscription allowance, or charged premium-request total was measured. Tool-service, CI, storage, and other non-model charges are not included.</p>
  </section>
  <section id="usage-days"><h2>Daily recorded usage</h2>
    ${table(['UTC date', 'Requests', 'Priced-channel tokens', 'USD equivalent'],
      [...data.days].sort((a, b) => a.date.localeCompare(b.date)).map(row => [row.date, number(row.requests), number(row.pricedTokens), dollars(row.listPriceUsdExact)]), 'Daily usage by UTC event date')}
    <p class="audit-note">${escape(data.dayBoundary)}. Request-active wall time is not summed across models or agents.</p>
  </section>
  <section id="usage-scope"><h2>Scope, reconciliation, and privacy</h2>
    <dl class="audit-facts">
      <div><dt>Included event timestamps</dt><dd>${escape(scope.firstRecordedAt)} to ${escape(scope.lastRecordedAt)}</dd></div>
      <div><dt>Exclusive cutoff</dt><dd>${escape(scope.cutoffExclusive)}</dd></div>
      <div><dt>Captured</dt><dd>${escape(data.generatedAt)}</dd></div>
      <div><dt>Local coverage</dt><dd>${scope.machinesObserved} machine; ${scope.sessionsWithIncludedUsage} matching session with usage; ${scope.matchingSessionsWithoutIncludedUsage} matching sessions without included usage</dd></div>
      <div><dt>Material reference</dt><dd><a href="${escape(data.repository)}/commit/${escape(scope.materialCommit)}">${escape(scope.materialCommit)}</a></dd></div>
      <div><dt>Strict charge reconciliation</dt><dd>${number(data.coverage.includedRows)} / ${number(total.requests)} included rows</dd></div>
      <div><dt>Flat-column differences</dt><dd>${number(data.coverage.rowsWithFlatTokenColumnDifferences)} rows differ from the priced token-channel vector. This can reflect different channel definitions; it is not a count of failed requests.</dd></div>
    </dl>
    <p>The collector uses an exact working-directory match and a read-only SQLite transaction. It passes only pre-cutoff usage metadata to the upstream strict parser in memory. Missing, unsupported, or unreconciled critical values stop capture; the tool does not estimate them from prompt length or substitute flat token columns.</p>
    <p>No prompt text, responses, turn labels, paths, machine names, raw session/agent IDs, or individual request rows are published. Prompt and response tables are not queried. Model grouping, roles, channels, days, rates, and charge units reconcile before publication.</p>
    <details><summary>Provenance and integrity references</summary><p>Upstream commit: <a href="${escape(data.upstream.repository)}/tree/${escape(data.upstream.commit)}">${escape(data.upstream.commit)}</a>; version ${escape(data.upstream.version)}. The store, metrics, and intervals modules are unmodified; a local import shim and collection/presentation adapters are documented separately.</p>
      <p>Selected-usage digest: <code>${escape(data.integrity.sourceUsageRecordsSha256)}</code></p><p>${escape(data.integrity.note)}</p>
      <p>Capture-adapter SHA-256: <code>${escape(data.integrity.captureAdapterSha256)}</code></p>
      <p>Capture-configuration SHA-256: <code>${escape(data.integrity.captureConfigSha256)}</code></p>
      <p><a href="./usage-calc-provenance.json">Module provenance and checksums</a> · <a href="./usage-audit-config.json">Capture configuration</a></p>
    </details>
  </section>
  <section id="usage-limits"><h2>What this cannot establish</h2><ul>${data.limitations.map(item => `<li>${escape(item)}</li>`).join('')}</ul></section>`;
}

export function usageAuditSection(data) {
  return {
    id: 'audit-ai-usage',
    title: 'AI usage audit by recorded model',
    url: './ai-usage.html#usage-summary',
    paragraphs: [
      `The scoped local ledger records ${number(data.totals.requests)} requests across ${data.models.length} model identifier(s): ${data.models.map(row => row.model).join(', ')}. It includes ${data.totals.embeddedAgentCount} embedded delegated agents.`,
      `The recorded charges convert to ${dollars(data.totals.listPriceUsdExact)} under usage-calc's stated AI-credit assumption. This is a list-price equivalent, not an invoice or measured subscription spending.`,
      `The snapshot ends before ${data.scope.cutoffExclusive} and excludes producing the audit and later work. The website reads the published aggregate snapshot, not the private local ledger.`,
    ],
  };
}
import { createHash } from 'node:crypto';
