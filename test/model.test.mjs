import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, purchasingSavings, commonsCreditTax } from '../site/model.mjs';

test('published baseline conserves all receipts and yields $48 per member', () => {
  assert.deepEqual(settle(12_000_000, 1000), {
    grossCents: 12_000_000, members: 4_800_000, commons: 3_600_000,
    operations: 2_400_000, reserve: 1_200_000, perMember: 4800, memberLiability: 0,
  });
});
test('zero revenue has zero distributions', () => {
  assert.equal(Object.values(settle(0, 1)).every(value => value === 0), true);
});
test('rounding never loses money or diverts the member liability', () => {
  for (const gross of [1, 2, 3, 7, 101, 1234567, 1_000_000_000_000]) {
    for (const count of [1, 3, 1000, 1_000_000_000]) {
      const result = settle(gross, count);
      assert.equal(result.members + result.commons + result.operations + result.reserve, gross);
      assert.equal(result.perMember * count + result.memberLiability, result.members);
      assert.ok(result.memberLiability >= 0 && result.memberLiability < count);
    }
  }
});
test('invalid amounts and member counts fail explicitly', () => {
  for (const value of [-1, 1.5, NaN, Infinity, '100', 1_000_000_000_001]) {
    assert.throws(() => settle(value, 10), RangeError);
  }
  for (const value of [0, -1, 1.5, NaN, Infinity, '10', 1_000_000_001]) {
    assert.throws(() => settle(100, value), RangeError);
  }
});
test('published procurement benefit excludes licensing income', () => {
  assert.equal(purchasingSavings(24000, 2000, 2400), 2400);
  assert.equal(purchasingSavings(24000, 0, 2400), -2400);
  assert.throws(() => purchasingSavings(24000, 10001, 2400), RangeError);
});
test('sensitivity table agrees with settlement', () => {
  assert.deepEqual([0, 60000, 120000, 240000].map(dollars => settle(dollars * 100, 1000).perMember),
    [0, 2400, 4800, 9600]);
});

test('hypothetical 50% tax example distinguishes a credit from a deduction', () => {
  assert.deepEqual(commonsCreditTax(10_000_000_000, 1_000_000_000), {
    preCreditTax: 5_000_000_000, creditCap: 2_000_000_000, credit: 1_000_000_000,
    treasuryPayment: 4_000_000_000, totalCashOutlay: 5_000_000_000,
  });
});
test('commons credit cap preserves a treasury floor and excess spending is not refunded', () => {
  const result = commonsCreditTax(10_000_000_000, 3_000_000_000);
  assert.equal(result.credit, 2_000_000_000);
  assert.equal(result.treasuryPayment, 3_000_000_000);
  assert.equal(result.totalCashOutlay, 6_000_000_000);
});
test('zero and tiny tax bases cannot produce a refundable credit or negative liability', () => {
  assert.equal(commonsCreditTax(0, 1_000_000).treasuryPayment, 0);
  assert.equal(commonsCreditTax(0, 1_000_000).credit, 0);
  assert.equal(commonsCreditTax(1, 1).credit, 0);
  assert.equal(commonsCreditTax(200, 100).treasuryPayment, 60);
  for (const bad of [-1, 0.5, NaN, Infinity, '10', 1_000_000_000_001]) {
    assert.throws(() => commonsCreditTax(bad, 0), RangeError);
    assert.throws(() => commonsCreditTax(0, bad), RangeError);
  }
});
