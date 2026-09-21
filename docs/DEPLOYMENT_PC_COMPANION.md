# Deployment runbook — Cloudflare relay + PC companion

Status: ready for initial deployment. Production Cloudflare deployment has not yet been performed.

## Architecture

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

The PC that runs EasyEDA Pro is the relay peer. Do not provision a VPS and do not add Cloudflare Containers for this architecture.

## Required Cloudflare resources

- Workers
- Workers Static Assets
- Durable Objects
- SQLite-backed Durable Object class `EasyEdaSession`
- Worker secret `IPAD_TOKEN`
- Worker secret `VPS_TOKEN` (legacy binding name for the PC companion secret)

A custom domain is optional; the generated `workers.dev` URL is sufficient. D1, KV, R2, Queues, Containers, and VPS infrastructure are not required.

## Security before deployment

Use different random values for `IPAD_TOKEN` and `VPS_TOKEN`. Never commit them. Keep the EasyEDA bridge bound to loopback only and do not expose ports `49620-49629` or legacy direct companion port `49700` to the Internet.

## Pre-deployment checks

From the repository root:

```bash
npm ci
npm test
npm run build
npm run worker:typecheck
npx wrangler deploy --dry-run
node --check companion/server.mjs
node --check companion/cloud-agent.mjs
```

CI runs the same essential checks on pull requests and pushes to `main`.

## Cloudflare configuration

`wrangler.jsonc` already defines:

- `worker/index.ts` as the Worker entrypoint
- `dist/` as Static Assets
- `ASSETS` binding
- SPA fallback
- Worker-first handling for `/api/*` and `/ws/*`
- `SESSIONS` Durable Object binding
- declarative SQLite Durable Object export for `EasyEdaSession`
- observability

No extra application resource binding is required for the accepted deployment path.

## Initial deployment

Authenticate Wrangler:

```bash
npx wrangler login
```

Create the two production secrets:

```bash
npx wrangler secret put IPAD_TOKEN
npx wrangler secret put VPS_TOKEN
```

Deploy:

```bash
npm run cf:deploy
```

Record the generated Worker URL and the exact Git commit deployed. Do not record the secret values.

## Cloudflare-side verification

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

Authenticated session status:

```bash
curl -fsS \
  -H "Authorization: Bearer YOUR_IPAD_TOKEN" \
  https://YOUR-WORKER.workers.dev/api/session/default/status
```

Before the PC companion connects, `vpsConnected` should be false. The `vps` field name is retained only for protocol compatibility.

## PC companion

On the same PC as EasyEDA Pro, start the official EasyEDA API Gateway/bridge and confirm it is available on one of `127.0.0.1:49620-49629`.

PowerShell:

```powershell
$env:EASYEDA_CLOUD_URL = "https://YOUR-WORKER.workers.dev"
$env:EASYEDA_VPS_TOKEN = "YOUR_PC_COMPANION_TOKEN"
$env:EASYEDA_SESSION = "default"
npm run cloud-agent
```

The companion connects outbound to Cloudflare and scans only loopback for EasyEDA. No public inbound PC port is required.

## iPad connection

1. Open the deployed Worker URL in Safari.
2. Optionally Add to Home Screen.
3. Choose Cloudflare/PC companion mode.
4. Enter the same session name used by the PC companion.
5. Enter `IPAD_TOKEN`.
6. Connect and Refresh from EasyEDA.

## Live acceptance checklist

- [ ] `/api/health` returns `status: ok`.
- [ ] Authenticated session status succeeds.
- [ ] PC companion connects to Cloudflare.
- [ ] PC companion discovers EasyEDA API Gateway on loopback.
- [ ] Session status reports the companion connected.
- [ ] iPad connects using the same session and `IPAD_TOKEN`.
- [ ] Refresh from EasyEDA returns the real current document/project state.
- [ ] Validated tab navigation works.
- [ ] Current-project document opening works.
- [ ] Read-only component inspection works.
- [ ] Guarded X/Y nudge and ±90° rotation are tested first on a disposable project.
- [ ] Stopping/restarting the companion updates status and reconnects.
- [ ] EasyEDA bridge unavailable/recovered behavior is verified.
- [ ] No secret is present in committed files, screenshots, or shared logs.

This live checklist is LIVE-001. CI is necessary but does not satisfy it.

## Troubleshooting

If Worker health works but the companion cannot connect, verify `EASYEDA_CLOUD_URL`, the companion secret, outbound HTTPS/WSS, and session name. If the companion reaches Cloudflare but not EasyEDA, confirm EasyEDA Pro and its API Gateway are running on the same PC and listening on loopback ports `49620-49629`.

A 401 from the session endpoint means the iPad token is wrong. A 503 indicating a missing token means the corresponding Worker secret is not configured.

## Rollback

Record the deployed commit. If live validation fails, use Cloudflare Workers Versions & Deployments to roll back to the previous known-good version, then repeat health/session checks. Keep Worker and PC companion protocol versions aligned.
