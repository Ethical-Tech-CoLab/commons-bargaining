export const SHARES = Object.freeze({
  members: 4000,
  commons: 3000,
  operations: 2000,
  reserve: 1000,
});

export function settle(grossCents, memberCount) {
  if (!Number.isSafeInteger(grossCents) || grossCents < 0 || grossCents > 1_000_000_000_000) {
    throw new RangeError('Revenue must be a nonnegative whole number of cents, at most $10 billion.');
  }
  if (!Number.isSafeInteger(memberCount) || memberCount < 1 || memberCount > 1_000_000_000) {
    throw new RangeError('Eligible members must be a whole number between 1 and 1 billion.');
  }
  const members = Math.floor(grossCents * SHARES.members / 10000);
  const commons = Math.floor(grossCents * SHARES.commons / 10000);
  const operations = Math.floor(grossCents * SHARES.operations / 10000);
  // Fractional-cent allocation residue stays in the disclosed reserve.
  const reserve = grossCents - members - commons - operations;
  const perMember = Math.floor(members / memberCount);
  const memberLiability = members - perMember * memberCount;
  return { grossCents, members, commons, operations, reserve, perMember, memberLiability };
}

export function purchasingSavings(annualPriceCents, discountBps, duesCents) {
  for (const value of [annualPriceCents, discountBps, duesCents]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError('Price, discount, and dues must be nonnegative integers.');
    }
  }
  if (discountBps > 10000 || annualPriceCents > 1_000_000_000 || duesCents > 1_000_000_000) {
    throw new RangeError('Discount cannot exceed 100%; monetary inputs are limited to $10 million.');
  }
  return Math.floor(annualPriceCents * discountBps / 10000) - duesCents;
}

export function commonsCreditTax(taxBaseCents, eligibleContributionCents) {
  for (const value of [taxBaseCents, eligibleContributionCents]) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
      throw new RangeError('Tax base and eligible contribution must be whole nonnegative cents, at most $10 billion.');
    }
  }
  // Hypothetical policy: 50% rate, dollar-for-dollar nonrefundable credit,
  // capped at 40% of pre-credit liability. These are not enacted tax rules.
  const preCreditTax = Math.floor(taxBaseCents / 2);
  const creditCap = Math.floor(preCreditTax * 4000 / 10000);
  const credit = Math.min(eligibleContributionCents, creditCap);
  const treasuryPayment = preCreditTax - credit;
  return {
    preCreditTax, creditCap, credit, treasuryPayment,
    totalCashOutlay: treasuryPayment + eligibleContributionCents,
  };
}
