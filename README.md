# Commons Collective

**Collective Bargaining Institutions for the AI Data Commons**

[Read the research](https://ethical-tech-colab.github.io/commons-collective/) |
[Research PDF](https://ethical-tech-colab.github.io/commons-collective/commons-collective.pdf) |
[Focused first-draft paper](https://ethical-tech-colab.github.io/commons-collective/paper.html) |
[Institutional example](https://ethical-tech-colab.github.io/commons-collective/institution-example.html) |
[Live overview presentation](https://ethical-tech-colab.github.io/commons-collective/overview.html) |
[Open research questions](https://ethical-tech-colab.github.io/commons-collective/open-work.html) |
[Replication blueprint](https://ethical-tech-colab.github.io/commons-collective/blueprint.html) |
[AI usage audit](https://ethical-tech-colab.github.io/commons-collective/ai-usage.html) |
[Workshop sources](https://ethical-tech-colab.github.io/commons-collective/workshop.html) |
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

At the user's request, the supplied workshop photograph and each printed-card
crop are published with AI-assisted visual transcriptions and an editorial
research crosswalk. Original embedded image metadata is not copied. Printed
attributions are not verified spoken quotations or endorsements. Image and
quoted-source rights remain with their respective rights holders; the
research's license does not relicense them.

The user-supplied conference-note excerpt was reviewed for coverage. This is not
a claim of authenticated access to the full Google Doc or its other tabs. No
private communications, real consumer records, credentials, or payment details
are included.

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
- A private-institution service-operator model, existing commons funding examples,
  and an audited hypothetical cash worksheet with reserve and sensitivity checks.
- The quasi-commons tension: account-specific Claude Code policies, context versus
  training, and why AI-user and Wikimedia-contributor counts cannot be conflated.
- An open replication paper and editable charter, mandate, governance, pilot,
  business-model and sector-profile templates for six autonomous sector collectives.
- The original workshop brief, six attributed source cards and crops, a
  source-to-research map, and a review of the supplied conference-note excerpt.

## Run locally

Requires Node.js 22 or newer for building and Python for validation. The audit
collector supports Python 3.8+; use Python 3.12 for the complete test/PDF workflow.
GitHub Actions uses Node.js 24 and Python 3.12.

```powershell
npm ci
npx playwright install chromium
python -m pip install -r requirements-pdf.txt
npm run build
npm run pdf
npm test
npm run test:pdf
npm run preview
```

Preview uses Python 3's built-in HTTP server and listens only on
`http://127.0.0.1:4173`. The site build itself uses only Node; tests also exercise
the Python audit collector without accessing a real ledger.

Build-time dependencies are `marked` and `qrcode`, locked in the lockfile.
The QR code is generated locally from the canonical site URL, with a white
quiet zone; an independent decoder verifies its PNG version in the tests.
The deployed site has no runtime dependencies, analytics, external fonts,
API calls, cookies, or account system. The calculator processes only hypothetical
numbers locally in the browser. GitHub's own hosting infrastructure may retain
ordinary request logs under its policies.

## Controlled research PDF

`npm run pdf` exports the built main report through pinned Playwright and a
Chromium browser version 131 or newer. It uses a temporary loopback server that
closes after export; it does not read private sessions or external web resources.
The generator uses an installed compatible Chrome/Edge/Chromium when available,
or the browser installed by Playwright. `PDF_BROWSER_PATH` can select one explicitly.

The cover is one page with no running header; Abstract starts on page 2; every
numbered main-report section begins a new page. The footer has
`Commons Collective | Ethical Tech CoLab` on the left and current/total page
numbers on the right. Green and violet treatments remain visible using
print-safe contrasts; the dark cover retains its lime highlight.

`npm run test:pdf` inspects the actual generated PDF for page starts, headers,
footers, text preservation, semantic text colors, and in-margin raster images.
Regenerate the PDF after every site build. Pages CI performs both generation and
validation before publishing. Overview-slide printing is separate and unchanged.

## Edit and publish

1. Edit [research/report.md](research/report.md), citing evidence with `[S01]`
   style markers. Define each source in [research/sources.json](research/sources.json).
2. Run `npm run build`, `npm run pdf`, `npm test`, and `npm run test:pdf`.
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
The test command targets the source test directory, not the downloadable test
copies published inside `dist/`.

## Live overview and research work register

[The overview presentation](https://ethical-tech-colab.github.io/commons-collective/overview.html)
is a reader of published source data, not a separately maintained slide draft.
The ordinary build derives `presentation-data.json` from the main report, the
companion paper's current abstract, the source registers, project and demo pages,
and [research/open-work.json](research/open-work.json).
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

## Workshop source traceability

The provided photograph, seven card records, and printed attributions are held
in `research/workshop-statements.json`. The editorial coverage map is separate,
in `research/workshop-map.json`. Report markers such as `<!-- workshop:brief -->`
are expanded from those records into the website and Markdown download; the
same records also supply the standalone source page and live overview.

The user-provided conference-note excerpt is reviewed in
`research/conference-notes-review.json`; that is not a claim of authenticated
access to the complete Google Doc. `research/node-mechanisms.json` supplies the
four-mode intervention matrix. Source wording and editorial response are
distinguished, and printed attributions are not treated as spoken quotations.

The original attachment is unchanged. Published PNGs are generated from its
pixels without original embedded metadata; crops have declared coordinates and
are pixel-checked against the published frame. Source-image rights remain
separate from the project's original research and code licenses.

## AI usage accounting

The [AI usage page](https://ethical-tech-colab.github.io/commons-collective/ai-usage.html)
uses a reviewed aggregate snapshot and pinned, unmodified calculation modules
from [Ethical Tech CoLab usage-calc](https://github.com/Ethical-Tech-CoLab/usage-calc).
It reports recorded model IDs, requests, token channels, main/delegated work,
observed rates, and overlap-aware request time. USD figures are the tool's
list-price equivalents, **not actual subscription charges**.

See [usage/README.md](usage/README.md) for scope and reproduction. The initial
cutoff precedes this audit request, so its creation and later work are excluded.
No raw prompts, responses, working paths, machine names, or session/agent IDs
are published. The website and CI validate committed aggregates; they never
open the private session store. `python scripts\capture-ai-usage.py` is an
explicit local operation, not part of a website visit or normal build.

## File map

| File | Role |
|---|---|
| `research/report.md` | Canonical original research text |
| `research/sources.json`, `research/replication-sources.json` | Canonical source registers, merged for publication with bounded claims |
| `research/replication-blueprint.md` | Companion paper on autonomous sector collectives and evidence-gated replication |
| `research/publications.json` | Explicit public-paper allowlist and repository-only publication boundary |
| `papers/` | Standalone working drafts; only explicitly public entries are rendered or copied to the site |
| `templates/` | Original nonbinding drafting pack and explicitly unfilled six-sector profile |
| `research/open-work.json` | Canonical research questions, next steps, statuses, and source references |
| `research/workshop-statements.json` | Photo provenance, printed attributions, and canonical transcriptions |
| `research/workshop-map.json` | Editorial placement and coverage of every photographed direction |
| `research/conference-notes-review.json` | Bounded review of the user-provided note excerpt, not full-document access |
| `research/node-mechanisms.json` | Market, policy, non-market and philanthropic lenses for every request node |
| `site/template.html` | Accessible publication shell |
| `site/header.html`, `site/header.css` | Shared persistent Overview, Demos, Research navigation |
| `site/favicon.svg` | Shared green header mark and browser favicon |
| `site/qr-share.html`, `site/qr-share.css` | Locally generated project QR on the homepage and opening presentation slide |
| `site/styles.css` | Responsive CoLab-inspired styling and print layout |
| `site/model.mjs` | Pure integer-cent illustrative settlement arithmetic |
| `site/app.mjs` | Browser-only calculator and bibliography filter |
| `scripts/build.mjs` | Markdown, citations, navigation, and downloads |
| `scripts/generate-pdf.mjs`, `site/pdf.css` | Controlled main-report PDF export and print layout |
| `test/pdf-validation.py` | Actual-PDF pagination, content, image, footer, and color checks |
| `scripts/render-research.mjs` | Shared citation-aware renderer for the main report and companion paper |
| `scripts/publications.mjs` | Public-paper link resolution and exclusion of repository-only drafts |
| `scripts/presentation-data.mjs` | Derives live presentation data from canonical published sources |
| `scripts/capture-ai-usage.py` | Read-only, scoped local capture using CoLab usage-calc |
| `scripts/usage-audit.mjs` | Aggregate privacy/reconciliation validation and audit rendering |
| `usage/` | Public aggregate snapshot, fixed scope, and reproduction method; no raw ledger |
| `vendor/usage-calc/` | Pinned calculation subset, original MIT license, and source checksums |
| `site/ai-usage.html`, `site/ai-usage.css` | Dedicated model-by-model usage disclosure |
| `site/overview.html`, `site/overview.mjs`, `site/overview.css` | Source-loaded presentation and refresh states |
| `site/open-work.html`, `site/open-work.css` | Source-linked research work-register view |
| `site/workshop.html`, `site/workshop.css` | Original-image, card, and note provenance page |
| `examples/knowledge-object.json` | Fictional interoperable-object sketch, not a production contract/schema |
| `examples/reputation-observation.json` | Unexecuted evidence-record sketch, not a real reputation score or ERC implementation |
| `examples/component-passport.json` | Unfilled component-review record, not approval or runtime isolation |
| `examples/service-operator-economics.json` | Hypothetical annual cash model with protected liabilities and restricted funds |
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

Original research, editorial source annotations, institutional templates, and example data: **CC BY 4.0**. Attribute the report
title and repository, identify modifications, and do not imply endorsement.
Software: **MIT**, as set out in [LICENSE](LICENSE). External sources remain
under their respective terms; this repository does not relicense them.
The user-supplied workshop photograph, derived crops, and quoted/transcribed
source wording are expressly excluded from the project's licensing grant.
