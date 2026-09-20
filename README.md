# Yeastar MCP Server

MCP server for the [Yeastar P-Series PBX System](https://www.yeastar.com/p-series-pbx-system/) OpenAPI - read-only visibility into extensions, extension groups, trunks, inbound/outbound routes, IVR menus, ring groups, queues (including live call/agent status), the company contact directory, call detail records (CDR), call reports, backup metadata, and certificate metadata, for AI assistants and the WYRE Conduit gateway.

## Appliance/Edition Scope

**This connector targets the P-Series Appliance Edition's OpenAPI, base path `openapi/v1.0`.** Per Yeastar's own developer docs (help.yeastar.com, "P-Series Appliance Edition Developer Guide"), the API is **only** supported on:

- **Hardware models P550, P560, and P570** running **PBX firmware 37.7.0.16 or later**. Other Appliance Edition hardware (e.g. P510) is not documented as supporting the API at all - the docs state functionality "is only supported on P550, P560, and P570" without qualification.
- The docs do not describe any narrower per-endpoint model restriction beyond that - every endpoint this connector implements is covered by the same P550/P560/P570 + firmware-37.7.0.16+ statement.

**Cloud Edition is a separate product with its own developer guide and its own OpenAPI surface** (same `openapi/v1.0` base path structure, firmware requirement documented as 84.7.0.17+), which this connector's request/response shapes were **not** independently verified against - Appliance and Cloud Edition guides diverge in places (e.g. Cloud Edition additionally documents a v2.0 CDR surface not covered here). If a customer runs Cloud Edition, treat this connector as **unverified, not confirmed-incompatible** - most of the base OpenAPI mechanics (token exchange, response envelope, pagination) are described identically in both guides, but no endpoint here has been tested against a live Cloud Edition instance.

**Software Edition (self-hosted, non-appliance) and any other P-Series variant are out of scope** - not mentioned in the Appliance Edition API-support statement above, and not evaluated for this connector.

If a customer's actual hardware/edition is unknown, verify against the PBX web portal (Settings -> About, or the model shown in `yeastar_get_system_information`) before assuming this connector will work - a PBX outside P550/P560/P570 (Appliance) or Cloud Edition will very likely reject `get_token` outright with the API feature toggle unavailable in its portal at all.

## Authentication

Each Yeastar P-Series PBX is its own appliance, with its own domain/IP and its own credentials - there is no shared hosted API endpoint. A customer enables the API themselves in their PBX's web portal (**Integrations -> API**, toggle "API" on) and generates a **Client ID** and **Client Secret** there. This is **not** a browser-based OAuth consent flow - the customer pastes the resulting Client ID/Secret directly into the connect form, the same shape as this fleet's other self-hosted/BYO-instance connectors (e.g. Hudu, IT Glue), not the shared-app Authorization Code flow used for SaaS vendors like Cork.

This connector exchanges the Client ID/Secret for a short-lived **access token** itself - it never proxies them directly into a PBX request. Per Yeastar's docs (`POST /openapi/v1.0/get_token`), the wire format is genuinely `{"username": "<Client ID>", "password": "<Client Secret>"}` - Yeastar's own docs are explicit that these fields *are* the Client ID/Secret ("obtain the username from the Client ID on PBX web portal"), not a separate credential; this connector preserves that field naming rather than renaming it, since it's what the vendor's API actually expects on the wire.

**Token lifetime and caching.** Access tokens expire after **30 minutes**; refresh tokens after 24 hours. Yeastar also caps each application to **8 simultaneous valid tokens**. Because of that cap, this connector does not mint a fresh token on every tool call - `src/client.ts` caches the access token in memory, keyed by appliance + Client ID + Client Secret, and reuses it across calls until it's within 60 seconds of expiring. On a `TOKEN EXPIRED` response (errcode `10004`), it transparently mints a fresh token and retries the failed call exactly once. This is a deliberate deviation from the pattern in this fleet's other connectors (which mint per-request or hold a single static key) - it exists because Yeastar's token model genuinely requires it, not as an optimization for its own sake: without caching, any session making more than 8 tool calls within a 30-minute window would start failing with `MAX LIMITATION EXCEEDED` (errcode `60002`) from Yeastar itself.

In gateway mode, the three credential fields arrive per-request via `X-Yeastar-Pbx-Domain` / `X-Yeastar-Client-Id` / `X-Yeastar-Client-Secret` headers, injected by the Conduit gateway. In local/stdio mode they're read once from `YEASTAR_PBX_DOMAIN` / `YEASTAR_CLIENT_ID` / `YEASTAR_CLIENT_SECRET`.

**Every request also passes a mandatory `User-Agent: OpenAPI` header** - Yeastar's API rejects requests missing it (errcode `40002`, "PARAMETER ERROR").

**Defensive field-stripping.** Trunk configuration commonly carries SIP registration secrets (auth/register passwords) inline in the same object a read returns, and Yeastar's schema for these objects isn't machine-verifiable from the docs alone. Every response from every tool in this connector - not just trunk tools - passes through `stripSecretFields()` before it ever reaches the model: any object key matching `/secret|password|pwd/i`, at any depth, is dropped. This is a blanket safety net on top of, not instead of, the endpoint-level exclusions below (`extension/getpassword` and `conference/viewpassword` are never called at all).

### Credential-scope finding

**Structurally verified (this codebase):** this connector's `src/client.ts` implements exactly one HTTP verb function, `doGet` - there is no `doPost`/`doPut`/`doDelete` anywhere in this codebase, so it is *incapable* of issuing a write/control/delete request to the PBX regardless of what the credential itself is permitted to do. `src/__tests__/tool-scope.test.ts` pins the exact 26-tool set and asserts no tool name matches a write/control/credential-exposing token list.

**Vendor-documented, not independently verified:** whether the PBX's own admin portal offers any way to scope a Client ID/Secret pair to read-only access is **not documented**. Per help.yeastar.com's "Enable Yeastar P-Series PBX API" page, enabling the API surfaces exactly one toggle ("API" on/off) plus an optional IP-restriction allowlist and status-monitor configuration - no permission-group, role, or scope selection is described anywhere in that flow. This differs from e.g. Cisco Duo (`cisco-duo-mcp`), where the vendor's own admin panel offers explicit `Grant Read Resource` / `Grant Write Resource` toggles per integration. **The practical implication: a Client ID/Secret pair generated for this connector is, as far as Yeastar's own documentation shows, capable of the PBX's full write/control API even though this connector's code never exercises that capability.** The only vendor-side compensating control documented is the optional IP-restriction allowlist (scope the credential to only be usable from Conduit's egress IP(s)) - recommend enabling it. If a narrower credential-scoping mechanism does exist and simply isn't documented publicly, it wasn't found during this connector's build and should be treated as unconfirmed.

## Configuration

| Env var | Description |
|---|---|
| `YEASTAR_PBX_DOMAIN` | This appliance's own domain/IP and port, e.g. `https://pbx.example.com:8088` (default OpenAPI port is 8088). A bare host with no scheme is treated as `https`. |
| `YEASTAR_CLIENT_ID` | OAuth-style Client ID, generated in the PBX web portal under Integrations -> API. |
| `YEASTAR_CLIENT_SECRET` | OAuth-style Client Secret, generated in the same place. |
| `MCP_TRANSPORT` | `stdio` (default) or `http`. |
| `AUTH_MODE` | `env` (default, reads the vars above) or `gateway` (credentials arrive per-request via `X-Yeastar-Pbx-Domain`/`X-Yeastar-Client-Id`/`X-Yeastar-Client-Secret` headers, injected by the Conduit gateway). |
| `CONDUIT_S2S_SECRET` | When set, the HTTP transport requires a valid `X-Gateway-S2S` header (Conduit sidecar auth) on every `/mcp` request. |
| `LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error`. |

## Tools

All 26 tools are read-only. `yeastar_get_trunk` is additionally classified sensitive in Conduit's `VENDOR_TOOL_CONFIG` given trunk config's proximity to telephony secrets, even after field-stripping.

### System
- `yeastar_get_system_information` - this appliance's model, firmware version, hostname.
- `yeastar_get_system_capacity` - current usage against licensed extension/trunk/concurrent-call capacity.

### Extensions
- `yeastar_list_extensions` - list extensions with basic info and per-device online/presence status.
- `yeastar_get_extension` - full detail for a single extension (never includes its password).

### Extension Groups
- `yeastar_list_extension_groups` - list extension groups.
- `yeastar_get_extension_group` - full detail (member extensions) for one group.

### Trunks
- `yeastar_list_trunks` - list configured trunks.
- `yeastar_get_trunk` - full detail for a single trunk, with secret-shaped fields stripped.
- `yeastar_list_itsp_trunks` - list ITSP (VoIP provider) templates available for trunk creation.

### Routes
- `yeastar_list_inbound_routes` / `yeastar_get_inbound_route` - inbound call routing.
- `yeastar_list_outbound_routes` / `yeastar_get_outbound_route` - outbound call routing.

### IVR
- `yeastar_list_ivrs` / `yeastar_get_ivr` - auto-attendant menus.

### Ring Groups
- `yeastar_list_ring_groups` / `yeastar_get_ring_group`.

### Queues
- `yeastar_list_queues` / `yeastar_get_queue` - queue configuration.
- `yeastar_get_queue_call_status` - live calls waiting/in-progress in a queue.
- `yeastar_get_queue_agent_status` - live login/pause state of a queue's agents.

### Directory
- `yeastar_list_company_contacts` - the shared company-wide contact directory.

### CDR
- `yeastar_list_cdr` - call detail records, optionally bound by `start_time`/`end_time`.

### Call Reports
- `yeastar_list_call_reports` - aggregated call statistics, optionally bound by `start_time`/`end_time`.

### Backups
- `yeastar_list_backups` - backup metadata (name, time, size) for monitoring backup health.

### Certificates
- `yeastar_list_certificates` - TLS certificate metadata (name, domain, expiry) for monitoring cert expiry.

## Scope

**This is a deliberately narrow, read-only v1 surface.** `src/client.ts` implements exactly one HTTP verb function (`doGet`) - there is no `doPost`/`doPut`/`doDelete` anywhere in this codebase, so every write/control exclusion below is structurally enforced, not just documented. `src/__tests__/tool-scope.test.ts` pins the exact 26-tool set.

Operation names below are drawn from Yeastar's own "API Interfaces & Events Summary" reference page (help.yeastar.com, P-Series Appliance Edition Developer Guide) and cross-referenced against individual endpoint doc pages where noted.

**A namespacing note that matters for this list:** several of Yeastar's own delete/control operations use HTTP **GET** in their own reference summary (e.g. `extension/delete`, `queue/agent_login`) rather than DELETE/POST - this connector excludes them by operation *semantics* (they mutate or act), not by HTTP method alone. "GET-only by construction" above describes this connector's own verb function, not a claim that every Yeastar GET-method endpoint is safe to call.

### Hard-excluded - credential-exposing (never implemented)
- `extension/getpassword` - returns an extension's live SIP/portal password.
- `conference/viewpassword` - returns a conference room's live password.

### Hard-excluded - GET-verb operations that are actually actions, not reads (never implemented)
- `del_token` - revokes the current API token.
- `extension/delete`, `extension_group/delete`, `organization/delete`, `trunk/delete`, `company_contact/delete`, `phonebook/delete`, `inbound_route/delete`, `outbound_route/delete`, `vm/delete`, `vm/delete_extension_vm`, `extension_vm_greeting/delete`, `vm_greeting/delete`, `ivr/delete`, `ringgroup/delete`, `queue/delete`, `conference/delete`, `paging/delete`, `pin_list/delete`, `block_numbers/delete`, `allow_numbers/delete`, `message_channel/delete`, `message_queues/delete`, `message_campaign/delete`, `message_session/delete`, `certificate/delete`, `backup/delete`, `wakeupcall/delete` - object deletes.
- `queue/agent_login`, `queue/agent_pause`, `agent/login`, `agent/pause` - logs an agent in/out of a queue or changes their pause state.

### Hard-excluded - documented write/create/update/provisioning operations (never implemented)
- **System:** `system/sendemail`.
- **Extensions:** `extension/create`, `extension/update`, `extension/send_welcome_email`, `extension/uploadtempavatarfile`.
- **Extension Groups:** `extension_group/create`, `extension_group/update`.
- **Organization:** `organization/create`, `organization/update`.
- **Trunks:** `trunk/create`, `trunk/update`.
- **Contacts/Phonebook:** `company_contact/create`, `company_contact/update`, `phonebook/create`, `phonebook/update`.
- **Auto Provisioning:** `phone/batchcreate`, `phone/batchupdate`, `phone/batchreprovision`, `phone/batchreboot`, `phone/batchdelete`.
- **Routes:** `inbound_route/create`, `inbound_route/update`, `outbound_route/create`, `outbound_route/update`.
- **Voicemail:** `vm/create`, `vm/update`, `extension_vm_greeting/upload`, `vm_greeting/upload`.
- **IVR:** `ivr/create`, `ivr/update`.
- **Ring Groups:** `ringgroup/create`, `ringgroup/update`, `ringgroup/updateoptions`.
- **Queues:** `queue/create`, `queue/update`, `queue/honor_wrapup_time`, `queue_pause_reason/update`, `queue_option/update`.
- **Conference:** `conference/create`, `conference/start_interim_conference`, `conference/invite_member`, `conference/kick_member`, `conference/mute_member`, `conference/unmute_member`, `conference/update`.
- **Paging:** `paging/create`, `paging/update`.
- **Recording/Auto settings:** `autorecord/update`.
- **PIN & Number Control:** `pin_list/create`, `pin_list/update`, `block_numbers/create`, `block_numbers/update`, `allow_numbers/create`, `allow_numbers/update`.
- **Call Notes/Messaging:** `callnotes/update`, `message_channel/uploadphoto`, `message_channel/create`, `message_channel/createlivechat`, `message_channel/update`, `message_channel/updatelivechat`, `message_queue/create`, `message_queue/update`, `message_campaign/create`, `message_campaign/update`, `message_campaign/retry`, `message_session/transfer`, `message_session/close`, `message_session/archive`, `message_session/unarchive`, `message/batchupload`, `message/send`, `message/reaction`.
- **Voice Prompts:** `play_list/create`, `custom_prompt/upload`.
- **Infrastructure:** `webserver/update`, `certificate/upload`, `certificate/create`, `certificate/update`, `backup/create`.
- **API Feature Settings:** `extension_status_monitor/update`, `trunk_status_monitor/update`, `webhook/update`.
- **CDR:** `cdr/updateoption`, `cdr/updatedownloadoption`.
- **Hotel:** `wakeupcall/create`, `wakeupcall/update`, `hotel/checkout`.
- **SMS:** `sms/create`.
- **Call Control:** `call/dial`, `call/accept_inbound`, `call/refuse_inbound`, `call/listen`, `call/hold`, `call/unhold`, `call/mute`, `call/unmute`, `call/park`, `call/directly_forward_to_voicemail`, `call/transfer`, `call/add_member`, `call/play_prompt`, `call/hangup`, `call/record_start`, `call/record_pause`, `call/record_unpause`.
- **uaCSTA Call Control:** `uacsta_call/accept`, `uacsta_call/refuse`, `uacsta_call/hangup`.

### Hard-excluded - bulk content, audio, or unverified-secret-safety (never implemented)
- `recording/list`, `recording/search`, `recording/download`, `recording/playtoextension` - call recording audio.
- `vm/query`, `vm/get`, `vm/download`, `vm_group/list`, `vm_global_greeting/list`, `extension_vm_greeting/list`, `vm_greeting/list`, `extension_vm_greeting/record`, `extension_vm_greeting/play`, `extension_vm_greeting/download`, `vm_greeting/record`, `vm_greeting/play`, `vm_greeting/download` - voicemail message content, audio, and personal greetings.
- `backup/download` - the actual backup file, which can embed configuration secrets. (`backup/list`, metadata only, **is** implemented.)
- `system_log/list`, `system_log/download` - system logs; content not independently verified for secret-safety and no field-level stripping equivalent confirmed sufficient for arbitrary log lines.
- `certificate/get`, `certificate/query` - full certificate detail beyond list metadata; not evaluated for whether private key material could appear. (`certificate/list`, metadata only, **is** implemented.)

### Out of v1 scope (read-only, not implemented for narrowness - could be added later as a deliberate follow-up)
- **Messaging/SMS/chat:** `message_channel/*`, `message_queue/*`, `message_campaign/*`, `message_session/*`, `message/get`, `message/query` - out of scope for a voice-PBX-focused v1.
- **Paging:** `paging/list`, `paging/search`, `paging/get`, `paging/query`.
- **Conference:** `conference/list`, `conference/search`, `conference/get`, `conference/query`, `query_interim_conference`, `conference/query_ongoing_conference`.
- **PIN lists & number controls:** `pin_list/*`, `block_numbers/*`, `allow_numbers/*` (read variants).
- **Voice prompts:** `play_list/list`, `play_list/get`, `play_list/query`, `custom_ringtone/list`.
- **Personal phonebook** (distinct from `company_contact`, which **is** implemented): `phonebook/list`, `phonebook/search`, `phonebook/get`, `phonebook/query`.
- **Auto provisioning:** `phone/search`, `phone/get`, `auto_provisioning/compatibility`.
- **Organization:** `organization/list`, `organization/search`, `organization/get`, `organization/query`.
- **Call notes:** `callnotes/get`.
- **API feature settings** (meta-config of the API surface itself, not PBX telephony state): `extension_status_monitor/list`, `trunk_status_monitor/list`, `webhook/query`, `webhook/test`.
- **Hotel management:** `wakeupcall/list`, `wakeupcall/get`, `wakeupcall/query`.
- **Live call-state queries grouped under Yeastar's own "Call Control" category:** `call/query`, `call/park_status` - conservatively excluded despite being nominally read-only, consistent with this connector's hard scope boundary against anything the vendor itself categorizes as call control.
- **Reference data:** `timezone/list`.
- **System:** `system/get_menuoptions` - UI menu metadata, not PBX configuration/monitoring data.
- **CDR/report variants beyond what's implemented:** `cdr/search`, `cdr/download`, `cdr/getoption`, `cdr/getdownloadoption` (v1.0); `call_report/detail`, `call_report/download`; `call_schedule_report/list`, `call_schedule_report/download`; `myreport/list`. The separate Cloud Edition `openapi/v2.0` CDR surface is out of scope entirely (see Appliance/Edition Scope above).
- **`/search` and `/query` variants:** for every resource type that also documents `/search` and `/query` alongside `/list` and `/get` (extension, extension_group, trunk, inbound_route, outbound_route, ivr, ringgroup, queue, company_contact, pin_list, block_numbers, allow_numbers, message_channel, message_queue, message_campaign, message_session, play_list, certificate, backup, wakeupcall), this connector implements `/list` + `/get` only. `/search` is a filtered list and `/query` is a bulk multi-ID detail fetch - both overlap materially with `list`+`get` for this connector's monitoring use case.

They can be added as a follow-up if there's demand, after a deliberate scope decision - not by default.

## Development

```bash
npm install
npm run build
npm test
npm run lint   # tsc --noEmit
```

## Docker

```bash
docker build -t yeastar-mcp .
docker run -p 8080:8080 \
  -e YEASTAR_PBX_DOMAIN=https://pbx.example.com:8088 \
  -e YEASTAR_CLIENT_ID=... \
  -e YEASTAR_CLIENT_SECRET=... \
  yeastar-mcp
```
