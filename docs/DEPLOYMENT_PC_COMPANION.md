# Deployment runbook — Cloudflare relay + PC companion

Status: operational runbook for the accepted no-VPS / no-Container architecture.

This document describes the target production shape recorded in PR #8:

```text
iPad PWA
   |
   | HTTPS / WSS
   v
Cloudflare Worker + Static Assets
   |
   v
Durable Object session relay
   ^
   | outbound WSS only
   |
PC companion running beside EasyEDA Pro
   |
   | loopback only
   v
Official EasyEDA API Gateway / bridge
127.0.0.1:49620-49629
```

The PC that already runs EasyEDA Pro is the relay peer. Do not provision a VPS and do not add Cloudflare Containers for this architecture.

## 1. Required resources

### Cloudflare

| Resource | Required | Notes |
| --- | --- | --- |
| Workers | Yes | Runs `worker/index.ts` and the API/WebSocket endpoints. |
| Workers Static Assets | Yes | Serves the Vite `dist/` PWA. |
| Durable Objects | Yes | `SESSIONS` maps each logical session to `EasyEdaSession`. |
| Durable Object SQLite storage class | Yes | Declared by `wrangler.jsonc`; no separate D1 database is required. |
| Worker secret `IPAD_TOKEN` | Yes | Used by iPad clients and authenticated session-status requests. |
| Worker secret `VPS_TOKEN` | Yes, legacy name | This is the **PC companion secret**. The binding name has not yet been renamed. It does not imply a VPS. |
| Custom domain | Optional | A `workers.dev` URL is sufficient. |
| KV | No | Not used by the current implementation. |
| R2 | No | Not used. |
| D1 | No | Not used as a separate database. |
| Queues | No | Not used. |
| Cloudflare Containers | No | Explicitly excluded from the accepted architecture. |

### PC running EasyEDA Pro

- EasyEDA Pro running locally.
- Official EasyEDA Run API Gateway / bridge available on loopback.
- Bridge reachable on one of `127.0.0.1:49620-49629`.
- Node.js 22 or newer.
- npm.
- Outbound HTTPS/WSS access to the deployed Worker URL.
- No public inbound EasyEDA or companion port is required.

## 2. Current compatibility names

PR #8 changes the architecture to a normal PC companion, but several wire-level/internal names in the current implementation still use the older `vps` terminology.

Until the rename work lands, use these names exactly because they are part of the current code contract:

```text
Cloudflare secret:      VPS_TOKEN
PC environment variable EASYEDA_VPS_TOKEN
Companion WebSocket:    /ws/vps
Worker role/status:     vps / vpsConnected / vps-status
npm script:             npm run cloud-agent
implementation file:    companion/cloud-agent.mjs
```

These identifiers are compatibility names only. **They do not require or imply a VPS.** Do not rename them locally unless the Worker, PWA, companion and tests are changed together in a coordinated PR.

## 3. Security model before deployment

The relay is a privileged control path to EasyEDA. Treat both tokens as production secrets.

Rules:

- Use different random values for `IPAD_TOKEN` and `VPS_TOKEN`.
- Never commit either token.
- Never put `VPS_TOKEN` in frontend code or the PWA bundle.
- Keep the EasyEDA bridge bound to loopback only.
- Do not expose ports `49620-49629` to the LAN or Internet.
- Do not expose legacy direct-companion port `49700` to the Internet.
- Use HTTPS/WSS for all cloud traffic.
- Redact `token=` query-string values from screenshots, support tickets and copied logs.
- Session names are routing identifiers, not independent user authorization boundaries.
- The current relay accepts privileged execute requests from authenticated iPad clients; operate it as a trusted-operator system.

If a token may have been exposed, rotate it before continuing deployment.

## 4. Prepare the repository

Use a known commit or release candidate. Record the commit SHA before deployment.

```bash
git clone https://github.com/armtekcomputer-ops/easyeda-ipad.git
cd easyeda-ipad
git rev-parse HEAD
```

Install dependencies:

```bash
# Preferred after BUILD-008/package-lock.json is integrated:
npm ci

# On a commit that does not yet contain package-lock.json:
npm install
```

Pre-deployment checks:

```bash
npm test
npm run build
npm run worker:typecheck
npx wrangler deploy --dry-run
node --check companion/server.mjs
node --check companion/cloud-agent.mjs
```

A successful CI/build is necessary but does not replace a real iPad + EasyEDA end-to-end check.

## 5. Cloudflare configuration

`wrangler.jsonc` already declares:

- Worker entrypoint: `worker/index.ts`
- Static Assets directory: `./dist`
- Static binding: `ASSETS`
- Durable Object binding: `SESSIONS`
- Durable Object class: `EasyEdaSession`
- SQLite-backed Durable Object export
- Worker-first handling for `/api/*` and `/ws/*`
- observability enabled

No extra Container, D1, KV, R2 or Queue binding should be added for this deployment path.

Authenticate Wrangler:

```bash
npx wrangler login
```

Create two different strong secrets:

```bash
npx wrangler secret put IPAD_TOKEN
npx wrangler secret put VPS_TOKEN
```

Interpret `VPS_TOKEN` as `PC_COMPANION_TOKEN` operationally until the compatibility rename is merged.

Deploy:

```bash
npm run cf:deploy
```

Record the deployed Worker URL and the exact Git commit used.

Example:

```text
https://easyeda-ipad.<account>.workers.dev
```

## 6. Verify the Cloudflare side

Health check:

```bash
curl -fsS https://YOUR-WORKER.workers.dev/api/health
```

Expected shape:

```json
{
  "service": "easyeda-ipad-cloud",
  "status": "ok",
  "timestamp": 0
}
```

Do not depend on the example timestamp value.

Authenticated session status:

```bash
curl -fsS \
  -H "Authorization: Bearer YOUR_IPAD_TOKEN" \
  https://YOUR-WORKER.workers.dev/api/session/default/status
```

Before the PC companion connects, `vpsConnected` should be false. After it connects, `vpsConnected` should become true. The field name is currently a legacy compatibility name.

A 401 response means the iPad token is wrong. A 503 response referring to a missing token means the Worker secret has not been configured correctly.

## 7. Prepare EasyEDA Pro on the PC

Start EasyEDA Pro and the official Run API Gateway / bridge workflow before starting the cloud companion.

The companion scans only:

```text
127.0.0.1:49620
...
127.0.0.1:49629
```

The bridge must remain local to the PC. Do not create router port-forwards or public firewall rules for these ports.

If the bridge is not available yet, the companion can still start; it will retry the local ports with backoff and report that EasyEDA is disconnected.

## 8. Start the PC companion

On the same PC that runs EasyEDA Pro:

### PowerShell

```powershell
$env:EASYEDA_CLOUD_URL = "https://YOUR-WORKER.workers.dev"
$env:EASYEDA_VPS_TOKEN = "YOUR_PC_COMPANION_TOKEN"
$env:EASYEDA_SESSION = "default"
npm run cloud-agent
```

### Command Prompt

```bat
set EASYEDA_CLOUD_URL=https://YOUR-WORKER.workers.dev
set EASYEDA_VPS_TOKEN=YOUR_PC_COMPANION_TOKEN
set EASYEDA_SESSION=default
npm run cloud-agent
```

`EASYEDA_SESSION` must use only letters, digits, `_` or `-` and be 1-64 characters long.

Expected successful sequence includes messages equivalent to:

```text
Session: default
Local bridge: 127.0.0.1:49620-49629
Cloud mode: outbound WebSocket only
[cloud-agent] EasyEDA bridge connected on 127.0.0.1:4962X
[cloud-agent] Cloudflare relay connected
```

Some current log lines may still say `VPS Cloud Agent` or `on VPS`. Treat that wording as legacy naming; the process is running on the EasyEDA PC.

### Autostart guidance

For initial production validation, start the companion manually so failures are visible.

After the workflow is proven, use the operating system's service/startup mechanism with protected secret storage. Do not place the companion token in a publicly readable startup script, desktop shortcut argument, repository file, or shared Task Scheduler export.

The companion automatically reconnects to both the local EasyEDA bridge and Cloudflare with backoff.

## 9. Connect the iPad

1. Open the deployed Worker URL in Safari.
2. Optionally use **Add to Home Screen**.
3. Select the cloud relay mode. On a build that has not yet completed the terminology rename, the UI may still display **Cloudflare + VPS**; this means the PC companion path described here.
4. Enter the same session name used by `EASYEDA_SESSION`.
5. Enter `IPAD_TOKEN`.
6. Connect.
7. Refresh state from EasyEDA.
8. Confirm document/project/editor state corresponds to the PC's currently open EasyEDA project.

The iPad token is runtime state; it must not be compiled into the PWA bundle.

## 10. End-to-end acceptance checklist

Do not mark a deployment live based on CI alone. Record the Worker deployment, PC environment and actual device result.

- [ ] Worker `/api/health` returns `status: ok`.
- [ ] Authenticated `/api/session/<session>/status` succeeds with `IPAD_TOKEN`.
- [ ] PC companion connects to Cloudflare.
- [ ] PC companion discovers a loopback EasyEDA bridge on `49620-49629`.
- [ ] Session status reports the companion connected (`vpsConnected: true`, legacy field name).
- [ ] iPad connects using the same session and the iPad token.
- [ ] **Refresh from EasyEDA** returns the actual current document/project state.
- [ ] Switching among already-validated tabs behaves as expected.
- [ ] Opening a validated current-project document behaves as expected.
- [ ] Selection synchronization is checked only on a disposable/test project first.
- [ ] Stopping the companion makes the cloud relay show the peer disconnected.
- [ ] Restarting the companion reconnects without opening any public inbound port.
- [ ] No secret value appears in committed files, screenshots or shared logs.

Record separately whether the test used real iPad Safari/Home Screen PWA and a live EasyEDA API Gateway. Do not infer this from automated checks.

## 11. Troubleshooting

### Worker health works, but companion cannot connect

Check:

- `EASYEDA_CLOUD_URL` is the HTTPS Worker origin, not a `/ws/...` URL.
- `EASYEDA_VPS_TOKEN` exactly matches the Worker `VPS_TOKEN` secret.
- outbound HTTPS/WSS is allowed from the PC.
- `EASYEDA_SESSION` is valid.
- the Worker deployment being tested matches the expected commit.

The companion converts the configured HTTP(S) origin to WS(S) and connects to the current compatibility endpoint `/ws/vps` automatically.

### Companion connects to Cloudflare but not EasyEDA

Check that:

- EasyEDA Pro is running on the same PC.
- the official Run API Gateway / bridge workflow is active.
- a bridge is listening on one of `127.0.0.1:49620-49629`.
- no security software is blocking loopback WebSocket access.

Do not work around this by exposing the EasyEDA bridge publicly.

### iPad receives unauthorized

Check `IPAD_TOKEN`, not `VPS_TOKEN`. The two credentials have different roles and should never be swapped.

### Session looks disconnected after a PC restart

Restart the companion process after EasyEDA/API Gateway is available. The companion reconnect loop handles transient network/bridge outages, but the process itself must be running.

### UI still says VPS

That is a terminology migration issue, not a requirement to deploy a VPS. Verify the underlying architecture/branch before changing identifiers because `/ws/vps`, `VPS_TOKEN` and related message fields currently form one coordinated protocol.

## 12. Rollout strategy

Use a staged rollout:

1. Deploy the Worker from a recorded commit.
2. Verify health before starting the PC companion.
3. Start one PC companion using a non-critical EasyEDA test project.
4. Verify the authenticated session status.
5. Connect one iPad.
6. Perform read-only refresh/navigation checks first.
7. Perform any allowed mutation checks only on a disposable/test project.
8. Keep PR #5 transform work separate unless it is explicitly reviewed and accepted.
9. Record live results in the project handoff before expanding use.

Do not deploy an unreviewed mutation branch merely because the relay is healthy.

## 13. Rollback

### Worker rollback

Keep the previously known-good deployment/commit recorded before rollout.

If the new Worker/PWA deployment fails acceptance:

1. Stop new iPad activity.
2. Roll the Worker deployment back to the previous known-good version using Cloudflare Workers Versions & Deployments or the rollback command supported by the installed Wrangler version.
3. Re-run `/api/health`.
4. Re-check authenticated session status.
5. Reconnect the PC companion and iPad against the rolled-back protocol version.

Do not rotate secrets merely for a code rollback unless exposure is suspected or the protocol change explicitly requires new credentials.

### PC companion rollback

1. Stop the companion process.
2. Checkout the recorded known-good repository commit that matches the Worker protocol.
3. Install that commit's dependencies.
4. Restart the companion with the same Worker origin/session and appropriate companion secret.
5. Re-run the end-to-end acceptance checklist.

The Worker and companion are one relay protocol. Avoid running mismatched versions during rollback when message/envelope changes are involved.

### Durable Object caution

The current runbook does not introduce a new stored schema. Future releases may add persistent Durable Object state; if that happens, verify migration and rollback compatibility before reverting code.

## 14. What this architecture deliberately does not require

Do **not** add any of these unless a future approved design explicitly introduces them:

- VPS
- Cloudflare Containers
- Kubernetes
- public EasyEDA bridge ports
- public companion listener
- D1 database
- KV namespace
- R2 bucket
- Queue
- reverse SSH tunnel

The only Internet-facing application component in this design is Cloudflare. The EasyEDA PC initiates its relay connection outward.

## 15. Current known follow-up items

This runbook intentionally documents the architecture without taking ownership of code paths reserved by CORE-008.

Known follow-ups outside OPS-001 include:

- rename legacy `vps` protocol/UI/log terminology to `companion` in one coordinated change;
- finish reconciliation/integration of PR #8;
- complete Phase 7 inspector UI integration after its API/test foundation;
- implement R5 connection deadline/watchdog/recovery work after CORE-008 ownership is reconciled;
- implement R6 bounded pending-request TTL/in-flight cleanup;
- add transport behavioral tests from TEST-008;
- perform and record real iPad + live EasyEDA end-to-end validation.

Do not treat this documentation PR as evidence that those items are complete.
