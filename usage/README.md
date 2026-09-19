# AI usage audit

This is a **bounded, aggregate-only production snapshot**, not a billing report
or an automatically live meter. It uses the CoLab
[usage-calc](https://github.com/Ethical-Tech-CoLab/usage-calc) calculation modules
at commit `d688a913d298cec5cca722d73c328f756b3dd685`.

## Scope

- Project: Commons Collective.
- Material reference: commit `14215be94badc7389edd195b0bc8934a339a9cb2`.
- Exclusive cutoff: **2026-09-19T13:47:16.543Z**, the start of this audit request.
- Selection: exact normalized working-directory match in one local Copilot
  session store, including embedded delegated-agent records.
- This intentionally excludes producing this audit and later activity. Other
  machines, missing telemetry, and unlogged work are not established.

`ai-usage.json` is the public snapshot. `audit-config.json` records the scope,
cutoff, material reference, and reviewed model-ID allowlist. It contains no
local paths or raw session identifiers.

## What is reused

The original `store.py`, `metrics.py`, and `intervals.py` calculations are
vendored without changes, with their MIT license and normalized checksums in
`vendor/usage-calc/UPSTREAM.json`. The only package adaptation is a minimal
initializer to avoid importing unused dashboard features.

The collector uses a **read-only SQLite transaction**, selects usage rows before
the cutoff, and passes only that metadata to usage-calc in memory. It invokes:

- `store.load_events(..., strict=True)` for per-record charge reconciliation;
- `metrics.group` for model and role aggregation;
- `intervals.busy_union` for overlap-aware request time.

It never invokes prompt-label, conversation, all-project export, catalogue, or
energy-estimation functionality.

## Interpretation

Price-bearing `token_details_json`, not flat token columns, supplies the
channels and their rates. Differences between these representations are
reported; they do not imply that the requests failed. Every selected record's
calculated charge must equal its stored charge.

Nano-AIU is retained as an exact decimal integer string. The USD equivalent uses
the upstream assumption of one billion nano-AIU per AI credit and USD 0.01 per
credit. **This does not measure an invoice, subscription spending, allowances,
or charged premium requests.** Rates are taken per record, not guessed from a
model name or a blended average.

Cached traffic is not unique authored content. Reasoning metadata is shown
separately and is not added to the priced-channel total. Request counts are
ledger events, not human messages. The model ID does not establish exact model
weights, revisions, or hidden routing.

Summed request duration is additive work across concurrent agents. The union
removes overlapping intervals using usage-calc's interpretation of the recorded
timestamp and duration. Neither measure is human attention, pure GPU time, or
energy consumption. Daily accounting uses UTC event dates.

## Privacy and reproducibility

No prompts, responses, turn labels, paths, machine names, raw session or agent
IDs, or individual request rows are published. Only reviewed model IDs and
aggregate fields are allowed. Session identifiers are represented by hashes.
The selected-record digest commits to usage metadata, not prompt content; it is
not a provider signature or proof of the private ledger.
The snapshot also hashes the capture adapter and public configuration. A build
refuses a stale snapshot if either changed without recapture and review.

Readers can reconcile the published aggregates. Independently verifying the
original rows requires authorized local access; those records are not shared.

To refresh on the machine holding the ledger, with Python 3.8 or later:

```powershell
python scripts\capture-ai-usage.py
npm run build
npm test
```

The default ledger is the current user's `.copilot` session store, or the path
provided through `COPILOT_SESSION_STORE`. The collector also accepts `--db`,
`--scope-directory`, `--config`, and `--out`. Do not use another project's
working directory or combine unidentified machines.

To change the audited period, intentionally update the cutoff and material
reference in the config. Review new model identifiers before adding them to
`approvedModels`. Missing critical fields, unsupported channels, altered
upstream modules, or unreconciled charges stop capture rather than produce
success-shaped estimates.

When deliberately changing the audited period or accepted model set, review the
frozen-snapshot regression expectations as well as the new measurements. The
current assertions preserve the independently checked totals for this boundary.

The ordinary website build reads the committed snapshot and validates its
arithmetic and privacy schema. **GitHub Actions does not read a local ledger.**
Opening the public audit or overview only reads published data; it cannot collect
new private usage. Commit and push a reviewed snapshot to update the website.
