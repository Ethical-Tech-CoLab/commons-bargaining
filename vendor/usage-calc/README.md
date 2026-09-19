# Pinned CoLab usage-calc calculations

The three Python calculation modules and MIT license are copied from
[Ethical Tech CoLab usage-calc](https://github.com/Ethical-Tech-CoLab/usage-calc)
at commit `d688a913d298cec5cca722d73c328f756b3dd685`.

`UPSTREAM.json` records normalized SHA-256 checksums. The capture script checks
them before importing the code. Only the package initializer is a local shim;
the upstream dashboard, prompt-label reader entry points, contribution merger,
energy estimates, and other project discovery functions are not invoked.

The Commons Collective adapter uses the unmodified `load_events` reconciliation,
`group` aggregation, and `busy_union` interval calculation. It supplies only the
selected pre-cutoff usage rows through an in-memory SQLite table. No raw ledger,
prompts, responses, machine names, working paths, or individual usage rows are
published.

The upstream monetary conversion is a **list-price equivalent**, not a bill.
The code and its provenance do not establish subscription charges or unlogged
usage. The original [MIT license](LICENSE) applies to the vendored modules.
