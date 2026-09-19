# Commons Collective replication pack

**DRAFT / NOT EXECUTED · version 0.1 · 18 September 2026**

This is an open-source institution blueprint, not an incorporated organization, franchise offer, legal opinion, or certification. The proposed Commons Collective Federation (CCF) has no members, powers, accounts, or endorsements established by these documents. The Commons Collective Framework Agreement is the proposed framework supported by this drafting pack, not an executed agreement. **Do not create organizations or accounts automatically.** No supplied file can move money or authorize operations.

Project: [Commons Collective repository](https://github.com/Ethical-Tech-CoLab/commons-collective) · [Commons Collective publication](https://ethical-tech-colab.github.io/commons-collective/).

Private institutions may use this pack to found or host sustainable sector collectives, subject to the same necessity, authority and rights tests. Record actual customers, services, payers, recurring funding, costs and renewal evidence in the profile and pilot. Governance alone is not a business model; existing commons institutions and their funding models are starting points, not an assumed absence of workable models.

## Complete pack

| Artifact | Use |
| --- | --- |
| [Research paper](../research/replication-blueprint.md) | Rationale, six-sector comparison, falsifiable hypothesis, limitations. |
| [Additional sources](../research/replication-sources.json) | Verified primary sources S70–S74 and bounded claims. |
| [Existing sources](../research/sources.json) | Previously registered governance, rights, competition, and community evidence. |
| [Collective charter](collective-charter.md) | Local purpose, decision gate, authority, federation compact, accountability. |
| [Bargaining mandate](bargaining-mandate.md) | Precisely bounded, nonexclusive delegation and future-use withdrawal. |
| [Governance and benefits](governance-and-benefits.md) | Representation, rights floor, funds, liabilities, complaints, succession. |
| [Pilot and evaluation](pilot-and-evaluation.md) | Costs, risk metrics, baseline, 90-day and 180-day gates. |
| [Service-operator business model](business-model.md) | Private-institution offering, customers, costs, ledgers, financing and renewal gates. |
| [Hypothetical financial worksheet](../examples/service-operator-economics.json) | Reconciled planning inputs, protected liabilities, reserves and sensitivities; not a forecast. |
| [Financial checks](../test/operator-economics.test.mjs) | Arithmetic and disclosure tests, not accounting or investment advice. |
| [Main source report](../research/report.md) | Related financial and institutional research; website-oriented links resolve in the publication. |
| [Sector profile](sector-profile.json) | UNFILLED, illustrative, invalid-for-operation starting data, including six adapters. |
| [Artifact checks](../test/replication.test.mjs) | Node built-in tests of completeness and declared boundaries, not legal validation. |

## Fork steps and go/no-go order

1. **Map before founding.** Inventory existing commons organizations, constituencies, suppliers, legal mandates, missing services, and duplication risks. Fund participation by people otherwise unable to attend.
2. **Choose with evidence.** Complete the charter's fork/adapt/federate/create-new decision matrix. Prefer adapting effective existing organizations. Obtain affected-community authority before purporting to represent a community.
3. **Fork the pack.** Copy the files into your own repository or document workspace; assign a distinct name, accountable maintainer, version, changelog, and accessible contact. Record the upstream version and license. A fork creates documents, not an entity.
4. **Select one sector.** Use `allowedSectors` and its adapter in the JSON. Replace every `[REQUIRED: ...]` and `null` relevant to your proposal with supported local facts. Keep the distributed original unchanged for comparison. One collective may span sectors only if its authority and safeguards are explicit for each.
5. **Map functions, not corporations.** Allocate scoped procurement, contributor agency, independent stewardship, professional operations, independent assurance, and regulated payments. Justify any new entity after examining hosted or federated alternatives.
6. **Validate locally.** Obtain jurisdiction-specific legal, competition, rights, privacy, governance, affected-community, safeguarding, payments/tax, and independent-assurance reviews. Record reviewer competence, scope, date, evidence, limitations, and expiry. “Not applicable” needs a reasoned review; silence is not approval.
7. **Approve a bounded pilot.** Use the mandate and budgets; appoint an independent appeals body and stop authority; fund complaints, accessibility, and exit. Complete the preflight checklist before inviting real transactions. Never mark the illustrative JSON as legal clearance.
8. **Run and evaluate.** Start with low-risk services; execute the 90-day and 180-day gates. Publish aggregated evidence and negative results. Halt activity that breaches the rights floor even if financially attractive.
9. **Maintain or wind down.** Document operator succession, portable mandates, ongoing duties, restricted balances, and legally required record retention. Open outputs remain available after exit.

## Independence with interoperability

Each sector collective controls its membership, treasury, operator, jurisdiction, and lawful contracts. A federation shares versioned field definitions, service descriptions, mandate receipts, redacted assurance reports, and referral routes. It does not impose prices, territories, buyers, exclusivity, mandatory licensing, or pooled liability. Cross-collective purchases need separate, counsel-reviewed delegations; financial and competitive information stays compartmentalized.

Publish methods, aggregate budgets, protocol changes, conflicts, and findings. Keep identity documents, live bids, sensitive mandates, student records, sources, and restricted community information private. Interoperability is not unrestricted data sharing. Members may export their own records through authenticated, rights-checked processes, not other people's records.

All templates require **authority**, **rights**, **appeal**, **exit**, and **approvals** fields. Brackets and `null` mean unresolved prerequisites, never default permission. The profile deliberately has `validForOperation: false`, `operationAllowed: false`, `syntheticExample: true`, and every essential approval `not-reviewed`. No JSON Schema is supplied: tests check explicit structural invariants and content, not full schema conformance or legal sufficiency.

## Version and evidence discipline

Pin the document revision and source IDs used for each decision. Record source title, URL, access date, claim, limit, and legal update date; distinguish evidence, interpretation, and proposals. Do not publish private evidence merely to make a citation clickable. Use restricted evidence references plus an independently verifiable public summary. Recheck laws, guidance, permissions, and community authority before launch and material changes.

## License and attribution

Original text and illustrative data in this pack, `research/replication-blueprint.md`, and `research/replication-sources.json` are offered under **Creative Commons Attribution 4.0 International (CC BY 4.0)**: <https://creativecommons.org/licenses/by/4.0/>. Attribute “Commons Collective replication blueprint contributors, 2026,” link the upstream version when available, and identify adaptations. Original test code uses **MIT**, as set out in the [repository license](../LICENSE). These grants do not claim rights over cited works.

**Third-party sources retain their own terms.** Nothing here relicenses third-party material, confers a trademark, implies endorsement, or allows disclosure of private records. Template clauses are original paraphrased proposals rather than copied legal clauses. Contributor withdrawal is not CC-license revocation.

## Local checks

From the project root, using its existing Node installation:

```powershell
node --test test\replication.test.mjs
```

Tests do not create entities, open accounts, process payments, verify professional qualifications, or certify compliance. A passing result means the distributed pack's documented guardrails and links are present; actual authority remains a human and legal determination.
