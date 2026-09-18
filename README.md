# Commons Bargaining

**Collective Bargaining Institutions for the AI Data Commons**

[Read the research](https://ethical-tech-colab.github.io/commons-bargaining/) |
[Source report](research/report.md) |
[Evidence register](research/sources.json) |
[Deployment](https://github.com/Ethical-Tech-CoLab/commons-bargaining/actions/workflows/pages.yml)

An AI-assisted academic discussion draft, dated **18 September 2026**, developed
from a session brief for the Ethical Tech CoLab. It combines an institutional
research agenda, a consumer-facing technical walkthrough, a transparent toy
settlement model, and a proposed philanthropic pilot.

## Status and attribution

This is **not peer-reviewed**, not a record of participant agreement, and not
legal or investment advice. The people named in the report were supplied as a
research circle; their inclusion is not a claim of authorship, attendance,
funding, affiliation verification, or endorsement. Human editorial and legal
review are required before treating the proposals as institutional commitments.

The supplied workshop image informed the questions but is not redistributed.
No private communications, real consumer data, credentials, or payment details
are included. Only the explicitly fictional example object is published.

The report operationalizes the CoLab's published field-grounded,
prototype-first, and open-by-default principles. It also draws on the CoLab's
published human-rights and participatory account of ethical AI. These
connections are documented rather than presented as a new official charter.

## Contents

- Data spectrum: mass-public, private, professional, synthetic, and community-held.
- Digital Costco: consumer purchasing power versus contributor bargaining.
- Institutional structure, governance, multi-sided markets, and public-good return.
- Creative Commons-compatible aggregation without enclosing open knowledge.
- Gmail analogy, permission scope, knowledge objects, and Alice/Bob workflows.
- A node-by-node divergence chart of concentrated capture risks and
  commons-serving choices across protocols, browser/agent, application, CDN,
  identity, database, compute, provenance, and settlement.
- Payment, disbursement, audited arithmetic, and business-model sensitivities.
- Regulatory options, data-center energy bargaining, and a hypothetical
  $10 million philanthropic strategy relevant to Humanity AI.
- Data dividends, Pigouvian versus rent taxation, and a hypothetical 50% tax
  with capped, auditable credits for additional commons support.
- Falsifiable hypotheses, staged research, safeguards, and stopping rules.

## Run locally

Requires Node.js 22 or newer. Node.js 24 is used in GitHub Actions.

```powershell
npm ci
npm run build
npm test
npm run preview
```

Preview uses Python 3's built-in HTTP server and listens only on
`http://127.0.0.1:4173`. Python is not required for building or deployment.

There is one build-time dependency, `marked`, locked in the lockfile.
The deployed site has no runtime dependencies, analytics, external fonts,
API calls, cookies, or account system. The calculator processes only hypothetical
numbers locally in the browser. GitHub's own hosting infrastructure may retain
ordinary request logs under its policies.

## Edit and publish

1. Edit [research/report.md](research/report.md), citing evidence with `[S01]`
   style markers. Define each source in [research/sources.json](research/sources.json).
2. Run `npm run build` and `npm test`.
3. Commit and push to `main`.

Every push to `main` automatically builds, tests, and deploys the site through
[GitHub Pages Actions](.github/workflows/pages.yml). Pull requests build and test
without deploying. Manual deployment is also available using `workflow_dispatch`.
Pages must be configured with **Source: GitHub Actions** (already configured for
this repository). No deployment secrets or paid services are needed.

The build fails on unknown citations, uncited source-register entries, invalid
source URLs, and incomplete source metadata. Tests verify internal links, assets,
publication coverage, the ten-node divergence map, fictional-example boundaries,
cash conservation, invalid inputs, rounding, the report's published baseline
and sensitivity figures, and the illustrative tax-credit cap and treasury floor.
Tests do not establish the truth of external claims or the legal enforceability
of the proposed institutions. External source access can change.

## File map

| File | Role |
|---|---|
| `research/report.md` | Canonical original research text |
| `research/sources.json` | Evidence, source URL, supported claim, and limitation |
| `site/template.html` | Accessible publication shell |
| `site/styles.css` | Responsive CoLab-inspired styling and print layout |
| `site/model.mjs` | Pure integer-cent illustrative settlement arithmetic |
| `site/app.mjs` | Browser-only calculator and bibliography filter |
| `scripts/build.mjs` | Markdown, citations, navigation, and downloads |
| `examples/knowledge-object.json` | Fictional interoperable-object sketch, not a production contract/schema |
| `test/` | Node built-in test-runner checks |
| `dist/` | Generated Pages artifact; intentionally not committed |

## Contributing

Use an issue or pull request to propose a correction. Identify the specific
claim, a primary source, jurisdiction and date, and whether the change concerns
evidence or a proposal. Do not upload personal data, contracts, or workshop
materials without the necessary authority. Legal assertions need qualified
review; financial scenarios must remain explicitly hypothetical.

Participant name spelling, full identities for first-name-only entries, and
formal authorship must be confirmed by the participants before a signed edition.
Published revisions should retain the evidence/proposal distinction.

## Suggested citation

*Commons Bargaining: Collective Bargaining Institutions for the AI Data Commons.*
(2026). Discussion draft v0.1, 18 September. Ethical Tech CoLab GitHub repository.
AI-assisted synthesis; human authorship and endorsement unconfirmed.
https://ethical-tech-colab.github.io/commons-bargaining/

## License

Original report text and original example data: **CC BY 4.0**. Attribute the report
title and repository, identify modifications, and do not imply endorsement.
Software: **MIT**, as set out in [LICENSE](LICENSE). External sources remain
under their respective terms; this repository does not relicense them.
