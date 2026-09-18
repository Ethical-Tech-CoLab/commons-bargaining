import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../examples/service-operator-economics.json', import.meta.url)));
const { inputs: i, operator: o, contributorAgencyLedger: a, commonsFund: c, reconciliation: r, liquidity: l } = data;
const anchorCost = i.curationPerAnchor + i.infrastructureSupportPerAnchor;
const surplus = (anchors, projects, price = i.anchorPrice) =>
  anchors * (price - anchorCost) + projects * (i.projectPrice - i.directCostPerProject)
  - i.continuingOperations - i.designatedCommonsAllocation;

test('the service-operator case is explicitly hypothetical and derives its operating cash', () => {
  assert.equal(data.hypothetical, true);
  assert.equal(data.unit, 'whole_dollars_per_year');
  assert.equal(o.earnedServiceReceipts, i.anchorCount * i.anchorPrice + i.projectCount * i.projectPrice);
  assert.equal(o.directServiceCostsPaid, i.anchorCount * anchorCost + i.projectCount * i.directCostPerProject);
  assert.equal(o.grossServiceContribution, o.earnedServiceReceipts - o.directServiceCostsPaid);
  assert.equal(o.surplusBeforeCommonsAllocation, o.grossServiceContribution - i.continuingOperations);
  assert.equal(o.retainedUnrestrictedCash, surplus(i.anchorCount, i.projectCount));
});

test('agency and restricted balances are not operator income or free reserves', () => {
  assert.equal(a.includedInOperatorRevenue, 0);
  assert.equal(a.passThroughReceipts - a.payments, a.closingPayable);
  assert.equal(a.closingPayable, a.closingCashForPayable);
  assert.equal(c.operatorTransferReceived, o.transferToRestrictedCommonsFund);
  assert.equal(c.externalRestrictedGrantReceived + c.operatorTransferReceived
    - c.publicMaintenancePaid - c.communityAccessParticipationPaid, c.closingRestrictedCash);
  assert.equal(l.availableUnrestrictedReserve, o.retainedUnrestrictedCash);
});

test('all cash reconciles with internal transfers eliminated exactly once', () => {
  assert.equal(r.operatorSideReceiptsIncludingPassThrough, o.earnedServiceReceipts + a.passThroughReceipts);
  assert.equal(r.operatorSideOutflowsIncludingInternalTransfer,
    o.directServiceCostsPaid + o.continuingOperationsPaid + o.transferToRestrictedCommonsFund + a.payments);
  assert.equal(r.operatorSideReceiptsIncludingPassThrough - r.operatorSideOutflowsIncludingInternalTransfer,
    r.operatorSideClosingCashIncludingPayable);
  assert.equal(r.consolidatedExternalReceipts,
    o.earnedServiceReceipts + a.passThroughReceipts + c.externalRestrictedGrantReceived);
  assert.equal(r.consolidatedExternalOutflows, r.operatorSideOutflowsIncludingInternalTransfer
    + c.publicMaintenancePaid + c.communityAccessParticipationPaid - r.internalTransferEliminated);
  assert.equal(r.internalTransferEliminated, o.transferToRestrictedCommonsFund);
  assert.equal(r.consolidatedExternalReceipts - r.consolidatedExternalOutflows, r.consolidatedClosingCash);
  assert.equal(r.consolidatedClosingCash, o.retainedUnrestrictedCash + a.closingCashForPayable + c.closingRestrictedCash);
});

test('reserve gap and baseline sensitivities match the stated business case', () => {
  assert.equal(l.annualOperatorCashCostsExcludingPassThrough,
    o.directServiceCostsPaid + o.continuingOperationsPaid + o.transferToRestrictedCommonsFund);
  assert.equal(l.unrestrictedReserveTarget, l.annualOperatorCashCostsExcludingPassThrough * i.reserveMonths / 12);
  assert.equal(l.reserveFundingGap, l.unrestrictedReserveTarget - l.availableUnrestrictedReserve);
  assert.equal(l.reserveFundingGap, 90000);
  assert.equal(surplus(5, 6), 12000);
  assert.equal(surplus(6, 0), -12000);
  assert.ok(surplus(7, 0) >= 0);
  assert.equal(surplus(6, 0, 92000), 0);
  assert.equal(o.earnedServiceReceipts - o.directServiceCostsPaid * 1.2 - i.continuingOperations - i.designatedCommonsAllocation, 0);
  assert.equal(o.earnedServiceReceipts * 0.9 - o.directServiceCostsPaid - i.continuingOperations - i.designatedCommonsAllocation, -6000);
  assert.equal(o.earnedServiceReceipts - i.anchorPrice - o.directServiceCostsPaid - i.continuingOperations - i.designatedCommonsAllocation, -30000);
  assert.equal(c.publicMaintenancePaid + c.communityAccessParticipationPaid - c.operatorTransferReceived, 110000);
});

test('the publication states the model boundaries and key reconciled amounts', async () => {
  const report = await readFile(new URL('../research/report.md', import.meta.url), 'utf8');
  const section = report.split(/^## /m).find(part => /^\d+\. Private institutions and the commons service model/.test(part));
  assert.ok(section);
  for (const value of [o.earnedServiceReceipts, r.consolidatedExternalReceipts, r.consolidatedExternalOutflows, l.reserveFundingGap]) {
    assert.ok(section.includes(`$${value.toLocaleString('en-US')}`));
  }
  assert.match(section, /separate maintained-services scenario/);
  assert.match(section, /not a statutory P&L/);
});
