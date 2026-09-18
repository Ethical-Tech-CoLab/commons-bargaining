# Commons Collective

**Collective Bargaining Institutions for the AI Data Commons**

[Read the research](https://ethical-tech-colab.github.io/commons-collective/) |
[Live overview presentation](https://ethical-tech-colab.github.io/commons-collective/overview.html) |
[Open research questions](https://ethical-tech-colab.github.io/commons-collective/open-work.html) |
[Source report](research/report.md) |
[Evidence register](research/sources.json) |
[Deployment](https://github.com/Ethical-Tech-CoLab/commons-collective/actions/workflows/pages.yml)

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
- A free-entry buyers' and suppliers' club with optional paid services,
  meaningful supplier voting rights, and an affected-party council.
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
- Follow-on agreement research: coverage gaps, an annotated nonbinding framework,
  clause sketches, and go/no-go tests before legal implementation.
- Ethereum agent-registry precedents, scoped reputation evidence, and transparent
  eligibility-first ranking for data and the agents serving it.
- Waze and Weather Underground participation incentives, data-quality limits,
  and falsifiable scenarios for future AI demand for a governed data club.
- A concrete Commons Collective Federation blueprint and node-by-node levers
  for changing control, bargaining power, and benefit allocation.
- Commons-authored RL rewards, the limits of fixed reward quotas, and a proposed
  participation-and-outcomes regulatory pathway.
- A proposed pro-human stack definition with component accountability, rights
  boundaries, independent evidence, and scoped operational acceptance tests.
- A verified agent-harness and discovery shortlist, adoption incentives, and an
  unfilled component passport for an eligibility-first agency starter kit.

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

## Live overview and research work register

[The overview presentation](https://ethical-tech-colab.github.io/commons-collective/overview.html)
is a reader of published source data, not a separately maintained slide draft.
The ordinary build derives `presentation-data.json` from the report, source
register, project and demo pages, and [research/open-work.json](research/open-work.json).
It also publishes [the work register](https://ethical-tech-colab.github.io/commons-collective/open-work.html)
from that same canonical work file.

On opening the presentation or returning to it, the browser requests the current
published data with cache revalidation. Manual refresh is also available.
Freshness identifies the published revision and build time, not the date on which
research findings were independently reverified. Unpublished edits, failed
deployments, or network failures cannot be promised as current; failed refreshes
are surfaced rather than silently presenting old content as up to date.

To change an open question, next step, or status, edit the canonical work register
and push. To change the research, edit the report. The normal deployment updates
the source data automatically; no separate presentation regeneration or AI
summary maintenance is required. Renumbered source sections are resolved by their
titles; removed or ambiguous titles fail validation instead of leaving stale links.
Statuses describe empirical/institutional research, not completion of this website.

## File map

| File | Role |
|---|---|
| `research/report.md` | Canonical original research text |
| `research/sources.json` | Evidence, source URL, supported claim, and limitation |
| `research/open-work.json` | Canonical research questions, next steps, statuses, and source references |
| `site/template.html` | Accessible publication shell |
| `site/header.html`, `site/header.css` | Shared persistent Overview, Demos, Research navigation |
| `site/favicon.svg` | Shared green header mark and browser favicon |
| `site/styles.css` | Responsive CoLab-inspired styling and print layout |
| `site/model.mjs` | Pure integer-cent illustrative settlement arithmetic |
| `site/app.mjs` | Browser-only calculator and bibliography filter |
| `scripts/build.mjs` | Markdown, citations, navigation, and downloads |
| `scripts/render-research.mjs` | Shared citation-aware renderer for research documents |
| `scripts/presentation-data.mjs` | Derives live presentation data from canonical published sources |
| `site/overview.html`, `site/overview.mjs`, `site/overview.css` | Source-loaded presentation and refresh states |
| `site/open-work.html`, `site/open-work.css` | Source-linked research work-register view |
| `examples/knowledge-object.json` | Fictional interoperable-object sketch, not a production contract/schema |
| `examples/reputation-observation.json` | Unexecuted evidence-record sketch, not a real reputation score or ERC implementation |
| `examples/component-passport.json` | Unfilled component-review record, not approval or runtime isolation |
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

*Commons Collective: Collective Bargaining Institutions for the AI Data Commons.*
(2026). Discussion draft v0.1, 18 September. Ethical Tech CoLab GitHub repository.
AI-assisted synthesis; human authorship and endorsement unconfirmed.
https://ethical-tech-colab.github.io/commons-collective/

## License

Original report text and original example data: **CC BY 4.0**. Attribute the report
title and repository, identify modifications, and do not imply endorsement.
Software: **MIT**, as set out in [LICENSE](LICENSE). External sources remain
under their respective terms; this repository does not relicense them.
