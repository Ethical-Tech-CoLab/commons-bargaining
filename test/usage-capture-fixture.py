"""Synthetic, local-only fixtures for the aggregate audit collector."""

import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("capture_ai_usage", ROOT / "scripts" / "capture-ai-usage.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def assert_rejected(db, scope, config, message):
    try:
        module.capture(db, scope, config)
    except (ValueError, RuntimeError) as error:
        assert message.lower() in str(error).lower(), str(error)
    else:
        raise AssertionError("Invalid ledger was accepted: " + message)


with tempfile.TemporaryDirectory(prefix="commons-usage-fixture-") as directory:
    directory = Path(directory)
    scope = directory / "private-scope-directory"
    scope.mkdir()
    db = directory / "synthetic-ledger.db"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE sessions (id,cwd)")
    con.execute("CREATE TABLE turns (user_message,assistant_response)")
    con.execute("INSERT INTO turns VALUES (?,?)", ("PRIVATE_PROMPT_SENTINEL", "PRIVATE_RESPONSE_SENTINEL"))
    con.executemany("INSERT INTO sessions VALUES (?,?)", [
        ("private-session-id", str(scope)), ("other-private-session", str(directory / "unrelated")),
    ])
    con.execute("CREATE TABLE assistant_usage_events (" + ",".join(module.EVENT_COLUMNS) + ")")
    details = json.dumps([
        {"tokenType": "input", "tokenCount": 10, "costPerBatch": 20, "batchSize": 10},
        {"tokenType": "output", "tokenCount": 2, "costPerBatch": 50, "batchSize": 10},
    ])

    def row(identity, model, at, sid="private-session-id", agent=None, token_details=details):
        values = dict.fromkeys(module.EVENT_COLUMNS)
        values.update({
            "id": identity, "session_id": sid, "turn_index": 0, "agent_id": agent,
            "model": model, "input_tokens": 999, "output_tokens": 2,
            "cache_read_tokens": 0, "cache_write_tokens": 0, "reasoning_tokens": 1,
            "total_nano_aiu": 30, "request_multiplier": 1, "duration_ms": 5000,
            "time_to_first_token_ms": 10, "initiator": "user",
            "api_endpoint": "PRIVATE_ENDPOINT_SENTINEL", "reasoning_effort": "high",
            "finish_reason": "stop", "token_details_json": token_details, "created_at": at,
        })
        return [values[key] for key in module.EVENT_COLUMNS]

    con.executemany("INSERT INTO assistant_usage_events VALUES (" + ",".join("?" for _ in module.EVENT_COLUMNS) + ")", [
        row(1, "fixture-a", "2020-01-01T00:00:10Z"),
        row(2, "fixture-b", "2020-01-01T00:00:12Z", agent="private-agent-id"),
        row(3, "unapproved-later-model", "2020-01-01T00:00:20Z", token_details=None),
        row(4, "unrelated-model", "2020-01-01T00:00:11Z", sid="other-private-session", token_details=None),
    ])
    con.commit()
    con.close()
    config = json.loads((ROOT / "usage" / "audit-config.json").read_text(encoding="utf-8"))
    config["cutoffExclusive"] = "2020-01-01T00:00:20Z"
    config["approvedModels"] = ["fixture-a", "fixture-b"]
    before = hashlib.sha256(db.read_bytes()).hexdigest()
    result = module.capture(db, scope, config)
    assert hashlib.sha256(db.read_bytes()).hexdigest() == before, "source database changed"
    assert result["totals"]["requests"] == 2
    assert result["totals"]["nanoAiu"] == "60"
    assert result["totals"]["pricedTokens"] == 24
    assert result["totals"]["reasoningMetadataTokens"] == 2
    assert result["totals"]["modelWorkMs"] == 10000
    assert result["totals"]["requestActiveUnionMs"] == 7000
    assert result["totals"]["embeddedAgentCount"] == 1
    assert result["scope"]["excludedRowsAtOrAfterCutoff"] == 1
    assert result["coverage"]["rowsWithFlatTokenColumnDifferences"] == 2
    assert {row["model"] for row in result["models"]} == {"fixture-a", "fixture-b"}
    serialized = json.dumps(result)
    for private in ["PRIVATE_PROMPT_SENTINEL", "PRIVATE_RESPONSE_SENTINEL", "PRIVATE_ENDPOINT_SENTINEL",
                    "private-session-id", "private-agent-id", "private-scope-directory", "unrelated-model"]:
        assert private not in serialized, "private field escaped the aggregate allowlist"
    con = sqlite3.connect(db)
    con.execute("UPDATE assistant_usage_events SET total_nano_aiu=31 WHERE id=1")
    con.commit()
    assert_rejected(db, scope, config, "reconciliation")
    con.execute("UPDATE assistant_usage_events SET total_nano_aiu=30,token_details_json=NULL WHERE id=1")
    con.commit()
    assert_rejected(db, scope, config, "Missing token details")
    con.execute("UPDATE assistant_usage_events SET token_details_json=?,model='unapproved' WHERE id=1", (details,))
    con.commit()
    assert_rejected(db, scope, config, "unapproved model")
    con.execute("UPDATE assistant_usage_events SET model='fixture-a',token_details_json=? WHERE id=1",
                (json.dumps(json.loads(details) + [json.loads(details)[0]]),))
    con.commit()
    assert_rejected(db, scope, config, "duplicate token channel")
    con.close()
    print("Synthetic audit checks passed: strict charges, cutoff, scope, overlap, privacy, and read-only collection.")
