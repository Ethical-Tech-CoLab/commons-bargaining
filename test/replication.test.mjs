// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const paper = await read('research/replication-blueprint.md');
const addedSources = JSON.parse(await read('research/replication-sources.json'));
const existingSources = JSON.parse(await read('research/sources.json'));
const profile = JSON.parse(await read('templates/sector-profile.json'));
const templateNames = [
  'README.md',
  'collective-charter.md',
  'bargaining-mandate.md',
  'governance-and-benefits.md',
  'pilot-and-evaluation.md',
  'business-model.md',
];
const templates = Object.fromEntries(await Promise.all(
  templateNames.map(async name => [name, await read(`templates/${name}`)]),
));
const sectors = [
  'open-access', 'open-data', 'open-science', 'open-education',
  'open-cultural-heritage', 'open-journalism',
];
const approvalNames = [
  'jurisdictionLegalForm', 'competition', 'rightsAuthority', 'privacySecurity',
  'memberGovernance', 'affectedCommunity', 'safeguarding', 'paymentsTax',
  'independentAssurance',
];
const sourceIds = new Set([...existingSources, ...addedSources].map(source => source.id));

test('replication branding names the project, proposed institution and framework consistently', () => {
  assert.match(paper, /^# Commons Collective:/);
  assert.equal(profile.documentType, 'commons-collective-unfilled-sector-profile');
  assert.equal(profile.proposedFederation.name, 'Commons Collective Federation');
  assert.equal(profile.proposedFederation.abbreviation, 'CCF');
  assert.equal(profile.frameworkName, 'Commons Collective Framework Agreement');
  for (const text of [paper, templates['README.md'], templates['collective-charter.md']]) {
    assert.ok(text.includes('Commons Collective Federation (CCF)'));
    assert.ok(text.includes(profile.frameworkName));
  }
  const legacyBrand = new RegExp(['commons', 'bargaining'].join('[ -]'), 'i');
  for (const text of [paper, ...Object.values(templates), JSON.stringify(profile)]) {
    assert.doesNotMatch(text, legacyBrand);
  }
  assert.ok(templates['README.md'].includes('https://github.com/Ethical-Tech-CoLab/commons-collective'));
  assert.ok(templates['README.md'].includes('https://ethical-tech-colab.github.io/commons-collective/'));
});

test('companion paper is bounded and contains its research components', () => {
  const words = paper.split('\n## Source register\n')[0].trim().split(/\s+/u).length;
  assert.ok(words >= 1800 && words <= 2600, `paper has ${words} whitespace-delimited words`);
  for (const component of [
    'Abstract', 'Method and research question', 'Normative proposal',
    'Six sector adapters', 'Falsifiable pilot', 'Limitations',
  ]) assert.ok(paper.includes(component), `missing paper component: ${component}`);
  for (const status of [
    'only as a blueprint', 'not incorporated', 'not peer-reviewed',
    'not a systematic review', 'no observed bargaining results',
  ]) assert.ok(paper.includes(status), `missing paper limitation: ${status}`);
});

test('all six sectors have distinct paper sections and complete profile adapters', () => {
  assert.deepEqual(profile.allowedSectors, sectors);
  assert.equal(profile.sectorAdapters.length, sectors.length);
  assert.deepEqual(profile.sectorAdapters.map(adapter => adapter.sector), sectors);
  for (const sector of sectors) {
    const heading = sector.replaceAll('-', ' ');
    assert.match(paper.toLowerCase(), new RegExp(`### ${heading}:`));
  }
  for (const adapter of profile.sectorAdapters) {
    for (const field of ['scope', 'benefitsAllocation', 'pilot']) {
      assert.equal(typeof adapter[field], 'string', `${adapter.sector}.${field}`);
      assert.ok(adapter[field].length > 30, `${adapter.sector}.${field} is not actionable`);
    }
    for (const field of [
      'constituency', 'legitimateAuthority', 'negotiableGoodsServices',
      'nonNegotiableBoundaries', 'benefitsEvidence', 'buyerTypes',
      'outcomes', 'stoppingCriteria', 'sourceIds',
    ]) {
      assert.ok(Array.isArray(adapter[field]), `${adapter.sector}.${field}`);
      assert.ok(adapter[field].length >= 1, `${adapter.sector}.${field} is empty`);
      assert.ok(adapter[field].every(value => typeof value === 'string' && value.trim()));
    }
    for (const id of adapter.sourceIds) assert.ok(sourceIds.has(id), `unknown adapter source: ${id}`);
  }
});

test('sector differences retain their specific rights boundaries', () => {
  const adapters = Object.fromEntries(profile.sectorAdapters.map(a => [a.sector, JSON.stringify(a)]));
  for (const [sector, terms] of Object.entries({
    'open-access': ['Scholarly publication', 'already open articles', 'editorial'],
    'open-data': ['Nonrival', 'privacy', 'public facts', 'reidentification'],
    'open-science': ['whole research lifecycle', 'participant', 'negative findings'],
    'open-education': ['teacher', 'student', 'minor', 'grades', 'offline'],
    'open-cultural-heritage': ['Indigenous', 'custody', 'sacred', 'community', 'TK Labels'],
    'open-journalism': ['editorial independence', 'source protection', 'not all', 'fictional'],
  })) {
    for (const term of terms) assert.ok(
      adapters[sector].toLowerCase().includes(term.toLowerCase()),
      `${sector} missing ${term}`,
    );
  }
});

test('source additions have reserved IDs, bounded metadata, and actual paper citations', () => {
  assert.ok(addedSources.length > 0 && addedSources.length <= 7);
  const existingIds = new Set(existingSources.map(source => source.id));
  const addedIds = addedSources.map(source => source.id);
  assert.equal(new Set(addedIds).size, addedIds.length);
  for (const source of addedSources) {
    assert.match(source.id, /^S7[0-6]$/);
    assert.ok(!existingIds.has(source.id), `source collision: ${source.id}`);
    assert.deepEqual(Object.keys(source).sort(), [
      'id', 'author', 'year', 'title', 'url', 'claim', 'limit', 'accessed',
    ].sort());
    for (const value of Object.values(source)) assert.ok(typeof value === 'string' && value.trim());
    assert.equal(source.accessed, '2026-09-18');
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.ok(source.claim.length > 40 && source.limit.length > 40);
    assert.ok(paper.includes(`[${source.id}]`), `uncited added source ${source.id}`);
  }
  for (const [, id] of paper.matchAll(/\[(S\d+)\]/g)) {
    assert.ok(sourceIds.has(id), `unregistered paper citation ${id}`);
  }
});

test('complete pack links exist and every declared artifact is linked in README', async () => {
  const required = [
    ...templateNames, 'sector-profile.json',
    '../research/replication-blueprint.md', '../research/replication-sources.json',
    '../research/sources.json', '../test/replication.test.mjs',
    '../research/report.md', '../examples/service-operator-economics.json', '../test/operator-economics.test.mjs',
  ];
  assert.deepEqual([...profile.packFiles].sort(), [...required].sort());
  for (const path of required) {
    await access(new URL(path, new URL('templates/', root)));
    if (path !== 'README.md') {
      assert.ok(templates['README.md'].includes(`](${path})`), `README missing ${path}`);
    }
  }
  const documents = [
    ['research/replication-blueprint.md', paper],
    ...Object.entries(templates).map(([name, text]) => [`templates/${name}`, text]),
  ];
  for (const [path, text] of documents) {
    for (const [, link] of text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|#)/.test(link)) continue;
      const resolved = new URL(link, new URL(path, root));
      assert.ok(resolved.href.startsWith(root.href), `${path} links outside pack workspace`);
      await access(resolved);
    }
  }
});

test('all markdown templates are visibly unexecuted and require authority, rights, appeal, exit and approvals', () => {
  for (const [name, text] of Object.entries(templates)) {
    assert.match(text, /DRAFT \/ NOT EXECUTED/, name);
    for (const term of ['authority', 'rights', 'appeal', 'exit', 'approvals', 'jurisdiction', 'evidence']) {
      assert.ok(text.toLowerCase().includes(term), `${name} missing ${term}`);
    }
    assert.match(text, /not-reviewed/, name);
    if (name !== 'README.md') {
      assert.match(text, /\[REQUIRED:/, `${name} lacks mandatory fill-ins`);
      assert.match(text, /NONBINDING/, `${name} lacks nonbinding label`);
      assert.match(text, /source/i, `${name} lacks source versioning`);
    }
  }
});

test('profile is explicitly illustrative, unfilled, and invalid for operation', () => {
  assert.match(profile.title, /UNFILLED.*invalid-for-operation/);
  assert.equal(profile.executionStatus, 'DRAFT-NOT-EXECUTED');
  assert.equal(profile.syntheticExample, true);
  assert.equal(profile.operationAllowed, false);
  assert.equal(profile.validForOperation, false);
  assert.equal(profile.legalCertificationClaimed, false);
  assert.equal(profile.proposedFederation.automaticEntityCreation, false);
  function assertUnfilled(value, path) {
    if (value === null) return;
    assert.equal(typeof value, 'object', `populated illustrative field ${path}`);
    assert.ok(!Array.isArray(value), `unexpected local array ${path}`);
    for (const [key, child] of Object.entries(value)) assertUnfilled(child, `${path}.${key}`);
  }
  assertUnfilled(profile.localProfile, 'localProfile');
  for (const key of ['jurisdiction', 'authorityEvidence', 'rightsAssessment', 'selectedSector']) {
    assert.equal(profile.localProfile[key], null, key);
  }
});

test('every essential approval is not-reviewed with no invented reviewer or approval evidence', () => {
  assert.deepEqual(Object.keys(profile.essentialApprovals).sort(), [...approvalNames].sort());
  for (const [name, approval] of Object.entries(profile.essentialApprovals)) {
    assert.equal(approval.status, 'not-reviewed', name);
    for (const key of ['reviewer', 'evidence', 'reviewedAt', 'conditionsAndExpiry']) {
      assert.equal(approval[key], null, `${name}.${key}`);
    }
  }
});

test('all six institutional functions exist without mandatory legal entity replication', () => {
  assert.deepEqual(Object.keys(profile.localProfile.functionAssignments).sort(), [
    'scopedMemberProcurement', 'contributorAgency', 'independentCommonsStewardship',
    'professionalOperator', 'independentAssurance', 'regulatedPayments',
  ].sort());
  assert.match(templates['collective-charter.md'], /without presuming a three-entity structure/);
  for (const option of ['forkAssessment', 'adaptAssessment', 'federateAssessment', 'createNewAssessment']) {
    assert.equal(profile.localProfile.decisionMatrix[option], null);
  }
  assert.match(templates['README.md'], /Prefer adapting effective existing organizations/);
});

test('founders must specify customers, services, funding and pilot viability without assumed revenue', () => {
  assert.deepEqual(Object.keys(profile.localProfile.customerServiceFunding).sort(), [
    'foundingOrHostingInstitutions', 'customerSegments', 'payerSegments',
    'serviceOfferingAndScope', 'demandAndRenewalEvidence', 'revenueOrFundingMechanism',
    'startupCapitalAndRestrictions', 'recurringCostsAndFunding', 'viabilityThresholdsAndRunway',
  ].sort());
  assert.match(templates['README.md'], /Private institutions may use this pack to found or host/);
  assert.match(templates['pilot-and-evaluation.md'], /recurring viability and renewal thresholds set before launch/);
  assert.match(templates['pilot-and-evaluation.md'], /compare actual service costs, revenue\/funding and renewal evidence/);
});

test('commons protections, nonexclusive mandates, and legal membership boundaries remain explicit', () => {
  const floor = profile.rightsFloor;
  for (const key of [
    'existingOpenKnowledgeRemainsOpen', 'nonexclusiveMandates', 'portableOnlyWithinVerifiedAuthority',
  ]) assert.equal(floor[key], true, key);
  for (const key of [
    'retrospectiveRoyaltiesForExistingPermissions', 'publicDomainEnclosure',
    'withdrawalRevokesCCLicense', 'historicalUseErasureGuaranteed',
    'newCommitmentsAfterEffectiveWithdrawal', 'majorityMayWaiveThirdPartyRights',
    'payToVote', 'charityOrTaxExemptionAssumed', 'allJournalismAutomaticallyOpen',
    'custodyEqualsRights', 'minorOrCommunityConsentAssumed',
  ]) assert.equal(floor[key], false, key);
  assert.deepEqual(floor.separateSchedules, [
    'paid-services', 'authorized-new-permissions', 'voluntary-commons-covenants',
  ]);
  assert.equal(profile.proposedFederation.nonexclusive, true);
  assert.equal(profile.proposedFederation.autonomousCollectives, true);
  assert.match(templates['collective-charter.md'], /lawful subsidy or solidarity/);
  assert.match(templates['collective-charter.md'], /member liabilities/);
});

test('withdrawal is prospective and distinguishes contracts, processing, licenses, and portability', () => {
  const mandate = templates['bargaining-mandate.md'];
  for (const term of [
    'UTC timestamp', 'effective withdrawal timestamp',
    'no new offers, commitments, renewals or permissions',
    'contract-by-contract schedule', 'consent-based processing',
    'not CC-license revocation', 'trained models', 'fresh, explicit authorization',
  ]) assert.ok(mandate.includes(term), `mandate missing ${term}`);
  assert.match(mandate, /No unreviewed common price/);
  assert.match(mandate, /competition counsel/);
  assert.match(mandate, /not sell mandate records as an asset/);
});

test('governance funds independent complaints, protects records, and provides orderly succession', () => {
  const governance = templates['governance-and-benefits.md'];
  for (const term of [
    'Affected-nonmember council', 'Supplier chamber', 'Independent commons stewards',
    'earmarked accounts', 'member liabilities', 'Complaints and remedy reserve',
    'Continuity/exit reserve', 'Open methods, private records',
    'Source', 'independent appeal', 'Operator succession', 'wind-down',
  ]) assert.ok(governance.toLowerCase().includes(term.toLowerCase()), `governance missing ${term}`);
  assert.match(governance, /bookkeeping alone is not asserted to protect funds from insolvency/);
  assert.match(governance, /No charity status/);
});

test('pilot gates are falsifiable, cost-inclusive, independently stoppable and evidence-limited', () => {
  const pilot = templates['pilot-and-evaluation.md'];
  for (const term of [
    '90-day gate checklist', '180-day gate checklist', 'at least 10%', 'At least 90%',
    'preregister', 'baseline', 'member time', 'payment fees', 'exit provisioning',
    'attrition', 'missingness', 'not supported / untested', 'stop authority',
    'not relabeled savings', 'negative findings',
  ]) assert.ok(pilot.toLowerCase().includes(term.toLowerCase()), `pilot missing ${term}`);
  assert.match(pilot, /operator cannot overrule the independent stop authority/);
  assert.match(pilot, /no causal claim follows from an uncontrolled small sample/);
  assert.match(pilot, /label savings \*\*untested\*\*/);
});

test('license and validation claims distinguish original content, code, and third-party sources', () => {
  const readme = templates['README.md'];
  assert.match(readme, /CC BY 4\.0/);
  assert.match(readme, /\*\*MIT\*\*/);
  assert.match(readme, /Third-party sources retain their own terms/);
  assert.match(readme, /No JSON Schema is supplied/);
  assert.match(readme, /not full schema conformance or legal sufficiency/);
  assert.match(readme, /Tests do not create entities, open accounts, process payments/);
  assert.equal(profile.contentLicense, 'CC-BY-4.0');
});
