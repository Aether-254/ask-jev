---
name: ask-jev
description: Use Jev for fast typed classification, ordered scoring, proposition probabilities, and the same judgment over batches of independent states. Applies when the user asks to classify, triage, rank, filter, route, score, or estimate likelihood with Jev.
---

# Ask Jev

Use the `jev_evaluate` MCP tool for one state and `jev_batch_evaluate` when the same questions apply independently to multiple states. Run `jev_ping` only for connectivity or configuration diagnosis.

## Shape the judgment

Choose the narrowest output primitive:

- `choice`: one result from 2-255 options. Give every option a concrete, mutually distinguishable description.
- `score`: one position on an ordered list. Put criteria from lowest to highest and make adjacent rungs meaningfully different.
- `noul`: probability that one proposition is true. Phrase the instruction as a single testable proposition.

Put all evidence needed for the judgment in `state`. Questions in one call are evaluated independently and cannot use another question's answer. Decompose dependent logic into separate calls and compose the results after receiving them.

Use stable, semantic question names because answers are keyed by those names. Preserve the returned probabilities and confidence when the user needs calibration, thresholds, ranking, or auditability.

## Batch work

Use one batch call when every state receives the same question set. Keep the returned `index` when joining results back to source records. Report per-item errors without discarding successful items. Start with the default concurrency; raise it only when latency matters and the backend tolerates the additional request rate.

For ranking, request a score or noul value per item, then sort in local code. For multi-stage routing, first run the broadest cheap judgment over the full batch, then evaluate only the surviving subset with a narrower question.

## Configuration failures

If a tool is unavailable, ensure the plugin MCP server is enabled. If `jev_ping` fails, surface its exact base URL, status, and error. Prefer the official `TYPESAFE_API_KEY`, `TYPESAFE_BASE_URL`, and `TYPESAFE_MODEL` names. The legacy `JEV_API_KEY`, `JEV_BASE_URL`, and `JEV_MODEL` names override their TypeSafe equivalents when both are set. `JEV_TIMEOUT_MS` and `JEV_MAX_RETRIES` control transport behavior; proxy variables are inherited by the server.
