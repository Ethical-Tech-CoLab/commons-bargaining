"""Capture a bounded, aggregate-only audit using pinned CoLab usage-calc.

No prompt/response tables are queried. The source database is read-only. Its
matching usage rows are read in one transaction, then only pre-cutoff records
are supplied to the upstream parser through an in-memory database.
"""

import argparse
import datetime as dt
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor" / "usage-calc"
EVENT_COLUMNS = (
    "id", "session_id", "turn_index", "agent_id", "model",
    "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens",
    "reasoning_tokens", "total_nano_aiu", "request_multiplier", "duration_ms",
    "time_to_first_token_ms", "initiator", "api_endpoint", "reasoning_effort",
    "finish_reason", "token_details_json", "created_at",
)


class AuditError(ValueError):
    pass


def utc(value):
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise AuditError("Audit timestamps must include a timezone")
    return parsed.astimezone(dt.timezone.utc)


def integer(value, label):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise AuditError("Invalid nonnegative integer: " + label)
    return value


def exact_usd(nano):
    return format(Decimal(nano) / Decimal(100_000_000_000), "f")


def tool_modules():
    provenance = json.loads((VENDOR / "UPSTREAM.json").read_text(encoding="utf-8"))
    for name, expected in provenance["files"].items():
        text = (VENDOR / name).read_text(encoding="utf-8-sig").replace("\r\n", "\n")
        if hashlib.sha256(text.encode("utf-8")).hexdigest() != expected:
            raise AuditError("Pinned usage-calc module differs from its recorded hash: " + name)
    sys.path.insert(0, str(VENDOR))
    from usagecalc.store import load_events, NANO_PER_AIU, CENTS_PER_AIU
    from usagecalc.metrics import group, CHANNELS
    from usagecalc.intervals import busy_union
    if NANO_PER_AIU != 1_000_000_000 or CENTS_PER_AIU != 1.0:
        raise AuditError("The upstream unit conversion needs an explicit adapter review")
    return provenance, load_events, group, CHANNELS, busy_union


def capture(db_path, scope_directory, config):
    provenance, load_events, group, channels, busy_union = tool_modules()
    if config.get("schemaVersion") != 1:
        raise AuditError("Unsupported audit configuration")
    cutoff = utc(config["cutoffExclusive"])
    approved = set(config["approvedModels"])
    wanted = os.path.normcase(os.path.abspath(scope_directory))
    if not Path(db_path).is_file():
        raise AuditError("The specified local usage store does not exist")

    source = sqlite3.connect(Path(db_path).resolve().as_uri() + "?mode=ro", uri=True)
    source.row_factory = sqlite3.Row
    selected = []
    excluded = 0
    try:
        source.execute("PRAGMA query_only=ON")
        source.execute("BEGIN")
        matched = [
            row["id"] for row in source.execute("SELECT id,cwd FROM sessions")
            if row["cwd"] and os.path.normcase(os.path.abspath(row["cwd"])) == wanted
        ]
        if not matched:
            raise AuditError("No sessions match the exact project working directory")
        available = {row[1] for row in source.execute("PRAGMA table_info(assistant_usage_events)")}
        if not set(EVENT_COLUMNS).issubset(available):
            raise AuditError("The local usage schema is missing required columns")
        for sid in matched:
            rows = source.execute(
                "SELECT " + ",".join(EVENT_COLUMNS)
                + " FROM assistant_usage_events WHERE session_id=? ORDER BY created_at,id",
                (sid,),
            )
            for raw in rows:
                row = dict(raw)
                if utc(row["created_at"]) < cutoff:
                    selected.append(row)
                else:
                    excluded += 1
    finally:
        source.close()
    if not selected:
        raise AuditError("No recorded usage falls inside the requested audit boundary")

    identifiers = set()
    rate_groups = {}
    missing_reasoning = 0
    nonzero_reasoning = 0
    flat_token_mismatches = 0
    for row in selected:
        if row["id"] in identifiers:
            raise AuditError("Duplicate usage-row identity")
        identifiers.add(row["id"])
        if row["model"] not in approved:
            raise AuditError("An unapproved model identifier needs review before publication")
        integer(row["duration_ms"], "duration")
        integer(row["total_nano_aiu"], "recorded charge")
        if row["reasoning_tokens"] is None:
            missing_reasoning += 1
        else:
            integer(row["reasoning_tokens"], "reasoning metadata")
            nonzero_reasoning += int(row["reasoning_tokens"] > 0)
        if not row["token_details_json"]:
            raise AuditError("Missing token details; refusing a column-based estimate")
        details = json.loads(row["token_details_json"])
        if not isinstance(details, list) or not details:
            raise AuditError("Token details must be a nonempty list")
        seen = set()
        row_tokens = {}
        for entry in details:
            kind = entry["tokenType"]
            if kind not in channels or kind in seen:
                raise AuditError("Unsupported or duplicate token channel requires an adapter review")
            seen.add(kind)
            count = integer(entry["tokenCount"], "token count")
            batch = integer(entry["batchSize"], "price batch size")
            cost = integer(entry["costPerBatch"], "price batch cost")
            if batch == 0 or cost % batch:
                raise AuditError("A nonintegral nano-unit token rate needs an adapter review")
            rate = cost // batch
            row_tokens[kind] = count
            key = (row["model"], kind, rate)
            summary = rate_groups.setdefault(key, {"tokens": 0, "requests": 0, "nano": 0})
            summary["tokens"] += count
            summary["requests"] += 1
            summary["nano"] += count * rate
        if any(row.get(kind + "_tokens") != row_tokens.get(kind, 0) for kind in channels):
            flat_token_mismatches += 1

    # The upstream parser sees only scoped, bounded usage metadata, not the source store.
    memory = sqlite3.connect(":memory:")
    memory.row_factory = sqlite3.Row
    events = []
    used_sessions = sorted({row["session_id"] for row in selected})
    try:
        memory.execute("CREATE TABLE assistant_usage_events (" + ",".join(EVENT_COLUMNS) + ")")
        memory.executemany(
            "INSERT INTO assistant_usage_events VALUES (" + ",".join("?" for _ in EVENT_COLUMNS) + ")",
            ([row[key] for key in EVENT_COLUMNS] for row in selected),
        )
        for sid in used_sessions:
            events.extend(load_events(memory, sid, strict=True))
    finally:
        memory.close()
    events.sort(key=lambda event: (event["ts"], event["id"]))
    for event in events:
        event["role"] = "delegated-agents" if event["agent_id"] else "main-assistant"
        event["day"] = dt.datetime.fromtimestamp(event["ts"], dt.timezone.utc).date().isoformat()
        event["all"] = "all"

    def aggregate(items, key, label):
        result = []
        for row in group(items, key, label):
            result.append({
                label: row[label],
                "requests": row["requests"],
                "tokens": {kind: row[kind] for kind in channels},
                "pricedTokens": sum(row[kind] for kind in channels),
                "reasoningMetadataTokens": row["reasoning"],
                "nanoAiu": str(row["nano_aiu"]),
                "listPriceUsdExact": exact_usd(row["nano_aiu"]),
                "modelWorkMs": row["duration_ms"],
            })
        return result

    totals = aggregate(events, "all", "group")[0]
    totals.pop("group")
    union_seconds, blocks = busy_union(events)
    totals["requestActiveUnionMs"] = round(union_seconds * 1000)
    totals["busyBlocks"] = blocks
    totals["embeddedAgentCount"] = len({event["agent_id"] for event in events if event["agent_id"]})
    models = aggregate(events, "model", "model")
    roles = aggregate(events, "role", "role")
    model_roles = []
    for model in sorted({event["model"] for event in events}):
        model_roles.extend(dict(row, model=model) for row in aggregate(
            [event for event in events if event["model"] == model], "role", "role"))
    channel_rows = []
    for kind in channels:
        count = sum(event["chans"].get(kind, {}).get("tokens", 0) for event in events)
        nano = sum(event["chans"].get(kind, {}).get("nano_aiu", 0) for event in events)
        channel_rows.append({"channel": kind, "tokens": count, "nanoAiu": str(nano), "listPriceUsdExact": exact_usd(nano)})
    rate_rows = [
        {
            "model": model, "channel": kind, "nanoAiuPerToken": str(rate),
            "usdPerMillionTokensExact": format(Decimal(rate) / Decimal(100_000), "f"),
            "tokens": values["tokens"], "requests": values["requests"],
            "nanoAiu": str(values["nano"]),
        }
        for (model, kind, rate), values in sorted(rate_groups.items())
    ]
    expected_nano = sum(row["total_nano_aiu"] for row in selected)
    if int(totals["nanoAiu"]) != expected_nano:
        raise AuditError("Upstream totals do not reconcile to the selected ledger rows")
    for name, rows in [("models", models), ("roles", roles), ("model roles", model_roles)]:
        if sum(row["requests"] for row in rows) != totals["requests"]:
            raise AuditError(name + " do not reconcile to request totals")
        if sum(int(row["nanoAiu"]) for row in rows) != expected_nano:
            raise AuditError(name + " do not reconcile to recorded charge units")
    if sum(int(row["nanoAiu"]) for row in channel_rows) != expected_nano:
        raise AuditError("Channel totals do not reconcile")
    canonical = json.dumps(sorted(selected, key=lambda row: row["id"]), sort_keys=True, separators=(",", ":"))
    return {
        "schemaVersion": 1,
        "project": config["project"],
        "repository": config["repository"],
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "scope": {
            "policy": config["scopePolicy"],
            "cutoffExclusive": config["cutoffExclusive"],
            "cutoffReason": config["cutoffReason"],
            "materialCommit": config["materialCommit"],
            "machinesObserved": 1,
            "matchingSessions": len(matched),
            "sessionsWithIncludedUsage": len(used_sessions),
            "matchingSessionsWithoutIncludedUsage": len(matched) - len(used_sessions),
            "sessionFingerprints": [hashlib.sha256(sid.encode("utf-8")).hexdigest() for sid in used_sessions],
            "firstRecordedAt": events[0]["at"],
            "lastRecordedAt": events[-1]["at"],
            "excludedRowsAtOrAfterCutoff": excluded,
            "otherMachinesVerified": False,
        },
        "upstream": {
            "name": "Ethical Tech CoLab usage-calc",
            "repository": provenance["repository"],
            "commit": provenance["commit"],
            "version": provenance["version"],
            "functions": ["store.load_events(strict=True)", "metrics.group", "intervals.busy_union"],
        },
        "pricing": {
            "nanoAiuPerCredit": "1000000000",
            "assumedUsdPerCredit": "0.01",
            "invoiceMeasured": False,
            "interpretation": "Recorded token charges converted using usage-calc's AI-credit assumption; a list-price equivalent, not subscription spending or an invoice.",
        },
        "coverage": {
            "includedRows": len(selected),
            "rowsWithTokenDetails": len(selected),
            "rowsWithRecordedDuration": len(selected),
            "rowsWithReasoningMetadata": len(selected) - missing_reasoning,
            "rowsWithNonzeroReasoningMetadata": nonzero_reasoning,
            "rowsWithFlatTokenColumnDifferences": flat_token_mismatches,
            "allSelectedChargesReconciled": True,
        },
        "integrity": {
            "sourceUsageRecordsSha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
            "captureAdapterSha256": hashlib.sha256(
                Path(__file__).read_text(encoding="utf-8-sig").replace("\r\n", "\n").encode("utf-8")
            ).hexdigest(),
            "captureConfigSha256": hashlib.sha256(
                json.dumps(config, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            ).hexdigest(),
            "note": "Digest commits to selected usage metadata, not prompts. It is not a provider signature or independent attestation of the private ledger.",
        },
        "totals": totals,
        "models": models,
        "roles": roles,
        "modelRoles": model_roles,
        "channels": channel_rows,
        "rates": rate_rows,
        "days": aggregate(events, "day", "date"),
        "dayBoundary": "UTC date of the recorded usage event, not inferred human workdays",
        "privacy": {
            "containsPrompts": False, "containsResponses": False, "containsTurnLabels": False,
            "containsPaths": False, "containsMachineNames": False, "containsRawSessionIds": False,
            "containsRawAgentIds": False, "containsIndividualRequestRows": False,
        },
        "limitations": [
            "This is a one-machine, selected-record snapshot, not proof that all project activity or other machines were logged.",
            "The fixed cutoff excludes this audit's production and later work; the snapshot does not refresh from private telemetry in GitHub Pages.",
            "Model identifiers are reported exactly as recorded, not mapped to unverified public product names.",
            "Requests are ledger events, not human messages; cached input is repeated traffic, not unique authored content.",
            "Reasoning metadata is not added to the priced token-channel total; zero does not establish absence of reasoning.",
            "Summed request duration is model work; union time removes overlaps using usage-calc's completion-timestamp interpretation. Neither measures GPU-hours or human attention.",
            "Recorded charge units reconcile; their USD interpretation follows the upstream conversion assumption and is not an actual bill.",
            "No energy, water, carbon, human labor, or output value is measured by this audit.",
            "Non-model tool services, CI, storage, network charges, and any hidden upstream routing are not measured.",
            "Raw records remain private. Readers can reconcile the published aggregates, but independent confirmation of the underlying ledger requires authorized local access.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=Path(os.environ.get(
        "COPILOT_SESSION_STORE", str(Path.home() / ".copilot" / "session-store.db"))))
    parser.add_argument("--scope-directory", type=Path, default=ROOT)
    parser.add_argument("--config", type=Path, default=ROOT / "usage" / "audit-config.json")
    parser.add_argument("--out", type=Path, default=ROOT / "usage" / "ai-usage.json")
    args = parser.parse_args()
    data = capture(args.db, args.scope_directory, json.loads(args.config.read_text(encoding="utf-8")))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("Audited %d requests, %d model identifiers, %d embedded delegated agents." % (
        data["totals"]["requests"], len(data["models"]), data["totals"]["embeddedAgentCount"]))
    print("Recorded list-price equivalent: USD " + data["totals"]["listPriceUsdExact"])
    print("Every included charge reconciled. Only the aggregate allowlist was written.")


if __name__ == "__main__":
    main()
