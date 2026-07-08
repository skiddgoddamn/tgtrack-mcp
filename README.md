<div align="center">

# tgtrack-mcp

**Manage a [tgtrack](https://tgtrack.ru) / «Откуда Подписки» account from an AI agent — channels, ad-system integrations, tracking-script settings, goals and links — with no official API.**

![license](https://img.shields.io/badge/license-MIT-blue)
![MCP](https://img.shields.io/badge/MCP-server-6E56CF)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![tests](https://img.shields.io/badge/tests-passing-34c759)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-34c759)

**English** · [Русский](./README.ru.md)

</div>

## Why

tgtrack ("Откуда Подписки") tracks **where your Telegram subscribers come from** and feeds offline *"subscription"* conversions back to Yandex Metrika / Direct. All of it — channels, "advertising systems" (integrations), the landing tracking-script, goals, links, daily reports — lives only in the `settings.tgtrack.ru` panel. There is **no public API**.

**tgtrack-mcp** exposes that control plane as [MCP](https://modelcontextprotocol.io) tools. It talks to the same internal endpoints the panel uses and **signs every request exactly like the panel does** (a short-lived JWT plus an md5-based request signature), so an AI agent (Claude, etc.) can list channels, read and create integrations, tweak the script settings, goals and links — in one turn.

- 🔑 **Uses your panel token** — a JWT read from the `settings.tgtrack.ru` URL; nothing is scraped or hardcoded
- 🧩 **18 focused tools** — read + safe writes; destructive actions gated behind `confirm: true`
- 🧮 **Panel-accurate signing** — `H = md5(md5(JSON + T) + T)`, verified against a live sample
- 🪶 **TypeScript, ESM, strict** — thin, MIT, no account secrets in the repo

## How it works

Every call is a `POST` to `https://api.tgtrack.ru/API/settings/<endpoint>.php` with a `multipart/form-data` body of two fields:

```
JSON = JSON.stringify({ ...params, T, tn })   // T = unix seconds, tn = your JWT
H    = md5( md5(JSON + T) + T )               // request signature (T is the salt)
```

The response is a `{ S, D, M }` envelope: `S === 0` means success and the payload is `D.data`; otherwise the tool returns a typed error (`217/218` = bad/expired token → a clear "refresh your token" message).

## Requirements

1. **Node ≥ 18.**
2. A **tgtrack token** (`TGTRACK_TOKEN`): open [settings.tgtrack.ru](https://settings.tgtrack.ru), and copy the `t=` value from the address bar (or the `tgtrack_token` cookie). It is short-lived (~72 h); tgtrack has no working refresh endpoint, so re-paste it when it expires.

## Setup

```bash
npm install
npm run build
```

Register it with your MCP client (see [`.mcp.json.example`](./.mcp.json.example)):

```json
{
  "mcpServers": {
    "tgtrack": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "TGTRACK_TOKEN": "<the ?t=... JWT from settings.tgtrack.ru>" }
    }
  }
}
```

## Tools

### Read

| Tool | Purpose |
|------|---------|
| `tgtrack_list_channels` | List all channels / groups / bots on the account. |
| `tgtrack_get_channel` | Full channel: integrations (ad systems), links, script & report settings. |
| `tgtrack_get_integration_script` | Build the ready `<script>` + `click.tgtrack.ru` link from `linkID` + `counterID` (no API call). |

### Integrations ("advertising systems")

| Tool | Purpose |
|------|---------|
| `tgtrack_create_integration` | Create an integration. For `yandex` returns `grantAccessUrl` + `webCreationCode` (finish the OAuth grant in a browser). |
| `tgtrack_set_script_settings` | Script settings of an integration (strict mode, conversion delay, auto-approve, goal flags…). |
| `tgtrack_update_goal` | Update a goal (name/value in Metrika), optionally create it. |
| `tgtrack_yandex_web_create_status` | Poll Yandex auto-goal creation by `webCreationCode`. |
| `tgtrack_get_restore_yandex_link` | Link to re-grant Yandex access for an integration. |

### Links & channel

| Tool | Purpose |
|------|---------|
| `tgtrack_get_landings` | Landings attached to a channel / integration. |
| `tgtrack_set_link_url` | Change a link's target URL. |
| `tgtrack_set_link_name` | Rename a link / integration. |
| `tgtrack_set_outbound_link_params` | Params of an under-post button link (target, button text, subscription check). |
| `tgtrack_set_channel_auto_approve` | Toggle auto-approval of join requests. |
| `tgtrack_set_report_settings` | Daily-report toggles (morning report, send-if-no-subs, traffic report). |

### Dangerous — require `confirm: true`

| Tool | Purpose |
|------|---------|
| `tgtrack_delete_invite_link` | ⚠️ Delete an invite link / integration (irreversible). |
| `tgtrack_delete_outbound_link` | ⚠️ Delete an outbound link (irreversible). |
| `tgtrack_new_api_token` | ⚠️ Mint a new API key — **invalidates the previous one**. |
| `tgtrack_new_report_key` | ⚠️ Mint a new report key — invalidates the previous one. |

Without `confirm: true` the dangerous tools return a description of what they *would* do and never touch the API.

## Usage

Run the MCP server over stdio, or call a tool directly for scripting:

```bash
node dist/index.js                                   # MCP (stdio)

TGTRACK_TOKEN=... npx tsx src/run.ts tgtrack_list_channels
TGTRACK_TOKEN=... npx tsx src/run.ts tgtrack_get_channel '{"chatID":"600334c8b9b9e"}'
TGTRACK_TOKEN=... npx tsx src/run.ts tgtrack_get_integration_script \
  '{"linkID":"5cd4255d831d9e","counterID":"110494105"}'
```

Streamable HTTP transport:

```bash
TGTRACK_TOKEN=... node dist/index.js --http --port 3001   # /mcp, /health
```

## Scope

**Included (v1):** the full settings/management control plane — channels, integrations, script settings, goals, links, reports.

**Not included yet:**
- **Analytics data** (subscribers over time, source breakdown, conversions) — this lives behind a separate reporting API keyed by a report key (`tgtrack_new_report_key`). Planned for v2.
- **Admin tools** (`deleteChannel`, `changeUserAccess`, …) — planned behind a flag (v1.1).
- **MAX** (`max.tgtrack.ru`) parity — behind a `service` option.

## Security

The token lives only in your environment (`TGTRACK_TOKEN`) — never in the repo, never logged, never echoed in error messages. `.mcp.json` and `.env` are git-ignored; only `.mcp.json.example` (with a placeholder) is committed.

## Contributing

Contributions welcome — open an issue or a PR.

1. Fork and branch: `git checkout -b feature/my-change`
2. `npm install`; `npm run build` and `npm test` must pass
3. **Never commit secrets** (the JWT / `.env` / a real `.mcp.json`) or real account data
4. Open a PR describing what and why

## License

MIT
