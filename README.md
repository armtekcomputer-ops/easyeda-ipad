# EasyEDA iPad

This repository contains an iPad-first PWA and Cloudflare relay for controlling a trusted EasyEDA Pro session through a PC companion.

## Current architecture

iPad PWA → Cloudflare Worker + Static Assets → Durable Object session relay ← outbound WSS ← PC companion → loopback EasyEDA API Gateway (`127.0.0.1:49620-49629`).

No VPS, Cloudflare Container, D1, KV, R2, or Queue is required for the accepted deployment path.

## Cloudflare deployment readiness

The application is ready for an initial Cloudflare deployment. Production has **not yet been deployed**.

Current deployment components are already declared in `wrangler.jsonc`:

- Worker entrypoint `worker/index.ts`
- Vite static assets from `dist/`
- SPA fallback
- Worker-first routing for `/api/*` and `/ws/*`
- Durable Object binding `SESSIONS`
- SQLite-backed declarative Durable Object export `EasyEdaSession`
- observability enabled

Production deployment additionally requires two Cloudflare Worker secrets:

- `IPAD_TOKEN`
- `VPS_TOKEN` — legacy binding name for the PC companion secret

Use different random values. Do not commit either value.

### Pre-deploy verification

```bash
npm ci
npm test
npm run build
npm run worker:typecheck
npx wrangler deploy --dry-run
node --check companion/server.mjs
node --check companion/cloud-agent.mjs
```

The repository CI runs these checks on pull requests and pushes to `main`.

### Deploy

```bash
npx wrangler login
npx wrangler secret put IPAD_TOKEN
npx wrangler secret put VPS_TOKEN
npm run cf:deploy
```

Then verify:

```bash
curl -fsS https://YOUR-WORKER.workers.dev/api/health
curl -fsS -H "Authorization: Bearer YOUR_IPAD_TOKEN" \
  https://YOUR-WORKER.workers.dev/api/session/default/status
```

For the full rollout, PC companion setup, iPad connection flow, security notes, acceptance checklist, and rollback procedure, see `docs/DEPLOYMENT_PC_COMPANION.md`.

## Local development

```bash
npm ci
npm run dev
```

Cloudflare local mode:

```bash
npm run cf:dev
```

## Important safety notes

- Keep the EasyEDA API Gateway loopback-only.
- Do not expose legacy direct-companion port `49700` to the Internet.
- Session names are routing identifiers, not independent authorization boundaries.
- Guarded component mutation is limited to the narrow trusted-state operations implemented by the project; broader editing remains in EasyEDA Pro.
- CI and dry-run validation do not replace real iPad + EasyEDA live validation after deployment.
