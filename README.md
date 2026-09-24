# ask-jev

[![CI](https://github.com/Aether-254/ask-jev/actions/workflows/ci.yml/badge.svg)](https://github.com/Aether-254/ask-jev/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`ask-jev` exposes the Jev System One API as an MCP server and packages it as a Codex/Claude plugin. It provides three tools:

- `jev_evaluate`: ask one or more typed questions about one state.
- `jev_batch_evaluate`: apply one question set to many independent states with bounded concurrency.
- `jev_ping`: verify endpoint, credentials, model, and round-trip latency.

The supported question primitives are `choice`, `score`, and `noul` (a probability in `[0, 1]`). States, instructions, and criteria can contain structured JSON as supported by the TypeSafe API.

## Requirements

- Node.js 20 or newer
- A TypeSafe API key from the [TypeSafe console](https://console.typesafe.ai/keys)

Clone the repository and expose the key to the process that launches your MCP client:

```powershell
git clone https://github.com/Aether-254/ask-jev.git
$env:TYPESAFE_API_KEY = "<your-key>"
```

The repository includes `.mcp.json` for clients that discover project-local MCP servers. Its entrypoint is the committed `mcp/dist/index.js` bundle, so consumers do not need to install npm dependencies or compile TypeScript.

## Configuration

The bundled defaults target TypeSafe's official `https://api.typesafe.ai/v1` endpoint with model alias `jev-latest`. Override them with environment variables when needed:

| Variable | Purpose | Default |
| --- | --- | --- |
| `TYPESAFE_BASE_URL` | API base URL, without `/systemone` | `https://api.typesafe.ai/v1` |
| `TYPESAFE_API_KEY` | Official TypeSafe bearer token | unset |
| `TYPESAFE_MODEL` | Model sent in requests | `jev-latest` |
| `JEV_TIMEOUT_MS` | Per-attempt timeout | `30000` |
| `JEV_MAX_RETRIES` | Retries after retryable failures | `3` |

`JEV_BASE_URL`, `JEV_API_KEY`, and `JEV_MODEL` remain supported for compatibility and take precedence over the corresponding `TYPESAFE_*` variables.

`HTTP_PROXY` and `HTTPS_PROXY` are supported.

## Development

The committed `mcp/dist/index.js` bundle is the plugin entrypoint. To rebuild and verify it:

```powershell
Set-Location mcp
npm ci
npm test
npm run typecheck
npm run build
npm run test:smoke
```

Run the live integration test only when the backend is reachable:

```powershell
$env:JEV_LIVE = "1"
npm run test:live
```

The MCP server communicates over stdio, so protocol output must remain on stdout and diagnostics must go to stderr.
