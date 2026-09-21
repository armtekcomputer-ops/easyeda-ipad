# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Multi-chat coordination — 2026-09-21

Read [WORKBOARD.md](WORKBOARD.md) on remote `main` before choosing or editing any task. It is the shared source for chat ownership, reserved paths, pending work, dependencies, leases and checkpoints. [AGENTS.md](AGENTS.md) makes this the entry workflow for future coding chats.

Every chat must register a unique chat ID, atomically claim its task/write paths using the current board SHA, verify the saved claim, work on a separate branch, and update its checkpoint before pausing or finishing. Re-read main before resuming; an expired lease requires reconciliation and does not automatically authorize takeover. Never merge stale branch copies of the board.

Current observation: PR #8 (`feat/pcb-component-inspector`) is open and titled “feat: harden trusted EasyEDA state and move relay to PC companion”; its observed head is `d6d8a6213d1504d8e63e0e7b373a969711b34b1d`. PR #5 is also still open. Their chat identities are unknown until self-registration. The board records both to prevent duplicate work. An open PR is not a capability merged into main; architecture and R1–R8 completion must be reconciled from the actual diff and checks.

This task adds coordination documentation only. Earlier “STOP after documentation review” and Phase 7 checkboxes below describe that review's scope/snapshot, not a global prohibition on later user-authorized work. For future work, follow the latest user instruction, refresh main/open PRs, and claim the matching board task first. Do not start a duplicate Phase 7 branch from the historical checklist.

At each milestone: update your board checkpoint; update this handoff for verified product changes; re-read both before continuing. Chat status is cooperative and only as current as its latest published update; no automatic cross-chat monitoring is installed.

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Base: `main`
Current completed version: `0.6.0`
Phase 6 PR: `#7` merged
Phase 6 merge commit: `a6941a74093dddf54fb1848293c17d4273d532a4`
Phase 6 final head: `fee123c1d74d5807cf70734840eec571fb72b9d7`
Phase 6 final CI: run `35598740884` — success

This file is the operational handoff. Continue work from this file first, not from chat memory.

## Current architecture

```text
iPad PWA
  |
  | HTTPS/WSS
  v
Cloudflare Worker + Durable Object relay
  ^
  | outbound WSS
  |
VPS Agent
  |
  | localhost
  v
EasyEDA bridge 127.0.0.1:49620-49629
  |
  v
EasyEDA Pro on VPS
```

## Completed capabilities

### Phase 1–2 — transport and iPad shell

- iPad-first PWA shell with touch/Pencil viewport foundation.
- Cloudflare Worker + Durable Object relay.
- VPS outbound cloud agent and Direct/LAN fallback.
- Separate iPad/VPS authentication secrets.

### Phase 3 — validated read-only EasyEDA state

- Typed `EasyEdaApi` command layer.
- Current document/project/PCB/schematic/selection snapshot.
- Browser-side schema validation and bounded primitive summaries.

### Phase 4 — selection synchronization

- Clear and re-apply selection using only verified PCB/SCH APIs.
- UI cannot type arbitrary primitive IDs; it reuses validated IDs read from EasyEDA.
- Successful mutations read back a fresh snapshot.

### Phase 5 — validated editor navigation

- Read validated open-tab/split-screen state.
- Activate another already-open validated tab.
- Fit all primitives or the current selection.
- Refresh trusted editor/document state after activation.
- Merged in PR #6.

### Phase 6 — current-project document browser

Merged in PR #7 as `a6941a74093dddf54fb1848293c17d4273d532a4` after exact-head CI run `35598740884` succeeded.

Implemented:

- bounded current-project schematic-page/PCB discovery
- top-level and Board-contained document discovery
- no arbitrary document UUID input
- membership revalidation immediately before `openDocument`
- `openDocument(documentUuid)` without guessed split-screen ID
- activation of the returned validated tab
- editor/snapshot/project-document read-back before local state is trusted
- strict rejection of malformed response types
- maximum 128 documents, UUID max 256 chars, names max 128 chars
- version `0.6.0`

Project switching remains intentionally disabled because official `openProject()` documentation warns that unsaved changes in the previously open project can be lost.

## Phase 7 target — selected PCB component inspector

Goal: make the iPad inspector useful for real PCB editing workflows without introducing geometry mutation yet.

Phase 7 is read-only. It will inspect exactly one currently selected PCB/footprint **component/device** and expose a bounded validated component state such as:

- primitive ID
- designator
- name
- X coordinate
- Y coordinate
- rotation
- locked state
- layer as a bounded scalar display value when safely representable

### Verified official APIs

Selection/document guard:

- `eda.dmt_SelectControl.getCurrentDocumentInfo()`
- `eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()`

Component lookup:

- `eda.pcb_PrimitiveComponent.get(primitiveId): Promise<IPCB_PrimitiveComponent | undefined>`

Component state getters on `IPCB_PrimitiveComponent`:

- `getState_PrimitiveId(): string`
- `getState_Designator(): string | undefined`
- `getState_Name(): string | undefined`
- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`
- `getState_PrimitiveLock(): boolean`
- `getState_Layer(): TPCB_LayersOfComponent`

Important: `pcb_PrimitiveComponent.get()` is documented as a **BETA** API. Phase 7 therefore remains read-only. The documented BETA `modify(...)` API must not be introduced in this phase.

### Phase 7 safety design

- Only PCB (`documentType = 3`) and footprint (`documentType = 4`) contexts are accepted.
- UI supplies only a primitive ID already present in the latest validated EasyEDA selection snapshot.
- Command re-reads current document type and current selected IDs before component lookup.
- Exactly one selected ID is required.
- Selected ID must equal the expected validated ID supplied by the browser.
- If lookup returns `undefined`, treat the selected primitive as not a component; do not guess another primitive class.
- Read only scalar getters needed for the inspector.
- Bound strings and reject non-finite numeric coordinates/rotation.
- No `modify`, `setState_*`, `done`, delete, create, save, route, or geometry mutation API.

## Phase 7 status

- [x] Phase 6 merged and final exact-head CI verified.
- [x] Verify `PCB_PrimitiveComponent.get()` and scalar component getters.
- [x] Confirm `modify(...)` exists but is BETA and explicitly exclude it from Phase 7.
- [ ] Create Phase 7 branch from current `main`.
- [ ] Add bounded selected-component inspector command/parser.
- [ ] Add tests proving only read APIs are called and mutation APIs are absent.
- [ ] Run CI before UI integration.
- [ ] Add iPad component inspector UI only after API/tests are green.
- [ ] Update README/version/HANDOFF, final CI, merge.

## Safety / correctness rules carried forward

- Use only exact documented public APIs from official EasyEDA repositories/references.
- Never guess method names or argument shapes.
- No secrets or gateway URLs in generated EasyEDA code.
- Treat all EasyEDA response values as untrusted until browser-side validation succeeds.
- Never accept arbitrary IDs/UUIDs for navigation or future write actions when a validated source list exists.
- Revalidate command targets against live EasyEDA state immediately before acting where practical.
- Never assume a write/navigation succeeded locally when documented read-back is available.
- Do not promote documented BETA mutation APIs into production-like UI without a separate explicitly scoped phase and stronger safeguards.

## Loop rule

The review-only instruction below overrides automatic continuation. Resume implementation only when the user explicitly requests it in a later task.

At each meaningful milestone after implementation is requested:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

STOP after this documentation review. The user's latest instruction is to assess the project and record recommendations in HANDOFF only; do not implement fixes, start Phase 7, merge/close PRs, or deploy in this task.

When the user later requests implementation, re-read current main, this handoff, and open PRs. Address the P1 correctness items below before extending the editing surface. The planned Phase 7 remains a read-only component inspector.


## Project review — 2026-09-21 (documentation only)

### ขอบเขตและหลักฐาน

ตรวจ source บน `main` commit `e721f59d4af280a25f12360d51aa74736af3ab7b`, README, package.json, repository tree, PR ที่เปิด และผล GitHub Actions โดยไม่ได้แก้ application code หรือรัน deployment

- เวอร์ชันใน package.json: **0.6.0**
- Phase 6 merge: `a6941a74093dddf54fb1848293c17d4273d532a4`
- CI ของ main ที่ตรวจ: [run 35599019907](https://github.com/armtekcomputer-ops/easyeda-ipad/actions/runs/35599019907) — success, head `e721f59d4af280a25f12360d51aa74736af3ab7b`
- Phase 7 ยังไม่พบ implementation ใน tree ของ main ที่ตรวจ
- [PR #5](https://github.com/armtekcomputer-ops/easyeda-ipad/pull/5) `feat/primitive-transform` ยัง open / ยังไม่ merged; head `4180c2f98191fed082927255d57f6372d4b9425b`. อย่านับ transform เป็นความสามารถของ main และอย่า merge อัตโนมัติ เพราะเป็นงาน geometry mutation แยกจาก Phase 7 read-only
- ไม่ได้ทดสอบ iPad จริง, live EasyEDA Gateway, VPS หรือ Worker production ในรอบนี้ ผล CI ไม่ใช่หลักฐานว่า deployment และ workflow จริงผ่านแล้ว
- รายการด้านล่างเป็น static-review findings และงานเสนอให้ทำต่อ แยกจากข้อบกพร่องที่ยืนยันด้วย live reproduction

### โปรเจกต์ตอนนี้เป็นอย่างไร

เป็น independent iPad PWA สำหรับควบคุมบาง workflow ผ่าน public EasyEDA APIs ไม่ใช่ EasyEDA Pro editor ฉบับเต็มบน iPad และไม่ใช่การย้ายตัว editor ไปรันใน Worker

โครงสร้างที่มีแล้วเหมาะกับทิศทางเดิม: PWA/relay อยู่ Cloudflare; EasyEDA Pro และ bridge อยู่ VPS; VPS เชื่อมออกด้วย WSS. มี typed command/parser, bounded results, validated document browser และ read-back หลังหลาย operation ซึ่งเป็นฐานที่ดีสำหรับพัฒนาต่อ

ช่องว่างสำคัญที่สุดของตัวผลิตภัณฑ์คือ **พื้นที่ PCB บน iPad ยังเป็น demo-board และเส้น SVG คงที่** ใน `src/App.tsx`; ข้อมูล project/document เป็นข้อมูลจริงจาก snapshot แต่ภาพบอร์ดไม่ใช่ geometry จริง ปุ่ม Wire/Route/Via/Text เปลี่ยน activeTool เท่านั้น จึงยังไม่ใช่เครื่องมือวาดวงจร ส่วน pinch/pan เป็นการขยับภาพ preview ภายใน PWA

| ส่วน | สถานะที่ตรวจพบ |
| --- | --- |
| PWA, touch viewport, Cloudflare relay, VPS agent | มี implementation |
| อ่าน project/document/selection | มี implementation และ command-layer tests |
| Selection sync | มี clear/re-apply IDs; ยังควรเสริม document identity guard |
| เปิดเอกสารใน current project / สลับแท็บ / fit viewport | มี implementation |
| Phase 7 component inspector | มี specification; ยังไม่พบ implementation ใน main |
| ย้าย/หมุน component | อยู่ PR #5 ที่ยังไม่ merge |
| แสดง PCB/schematic geometry จริงบน iPad | ยังไม่มีใน canvas ปัจจุบัน |
| Save/undo/redo/routing/property editing/project switching | ไม่อยู่ในขอบเขต main ปัจจุบัน |
| ใช้งานจริงครบสาย iPad → Worker → VPS → EasyEDA | ยังไม่มีหลักฐานจากการตรวจรอบนี้ |

### งานที่ควรแก้ก่อนเพิ่มฟีเจอร์

P1 = ควรแก้ก่อนเปิดใช้งานจริงกว้างขึ้นหรือเพิ่ม mutation; P2 = งานความเสถียร/ความชัดเจนที่ควรตามมา ไม่มีรายการใดถูก implement ในรอบนี้

| ระดับ / ID | จุดที่พบและผลกระทบ | ไฟล์ / แนวทางแก้ภายหลัง | เกณฑ์ตรวจรับ |
| --- | --- | --- | --- |
| P1 / R1 | Selection command ตรวจเพียง documentType ไม่เปรียบเทียบ UUID/tab กับ snapshot ต้นทาง หากผู้ใช้ desktop หรือ iPad อีกเครื่องเปลี่ยนเอกสารก่อนคำสั่งทำงาน อาจ clear/select บนเอกสารใหม่ | `src/lib/easyeda-api.ts` builders และ `src/App.tsx`: ส่ง expected document UUID/tab จาก validated snapshot แล้วเทียบ live identity ก่อน mutation; ปฏิเสธเมื่อเปลี่ยน | ทดสอบเอกสาร A → B ซึ่งมีชนิดเดียวกัน ต้องไม่เรียก selection mutation และ UI ขอ refresh |
| P1 / R2 | `runSelectionMutation` catch เปลี่ยนสถานะเป็น error แต่เก็บ snapshot เก่า และ selection controls ไม่บังคับ ready; เมื่อ mutation สำเร็จแต่ read-back ล้มเหลว ผู้ใช้อาจส่งคำสั่งต่อจากข้อมูลเก่าได้ นอกจากนี้ activate-tab/open-document มีเส้นทางที่ action อาจเกิดแล้วแต่ response/read-back ล้มเหลวและ trusted state ยังเหลือ | `src/App.tsx`: invalidate affected state เมื่อ outcome ไม่แน่นอน, บังคับ ready + fresh identity ก่อน action; แสดงว่าอาจดำเนินการแล้วและต้อง refresh ห้าม retry write อัตโนมัติ | จำลอง action สำเร็จแต่ read-back timeout, malformed result, activation read-back fail; ไม่มี control ใช้ stale IDs จน refresh สำเร็จ |
| P1 / R3 | Service worker intercept ทุก GET และ cache response โดยไม่แยก /api หรือ status/authorization; offline fallback อาจส่ง HTML shell ให้ API request หรือคืน session status เก่า | `public/sw.js`: cache เฉพาะ static assets ที่เหมาะสม; ข้าม API/authenticated requests และ /ws; จำกัด HTML fallback เฉพาะ navigation; ตรวจ response ก่อน cache | เรียก authenticated session status แล้ว offline ต้องไม่คืน cached status/HTML; static shell ยังเปิดได้ และ 401/500 ไม่ถูกเก็บเป็น success |
| P1 / R4 | Worker/gateway/cloud agent ใช้ JSON.parse แล้วอ่าน message.type โดยไม่ตรวจว่าเป็น non-null object; JSON `null` ผ่าน parse แต่ทำให้ property access throw ได้ ใน cloud-agent listener อาจทำให้ process หยุด | `worker/index.ts`, `src/lib/gateway.ts`, `companion/cloud-agent.mjs`: ตรวจ envelope ก่อนอ่าน field พร้อม type/size bounds; audit direct companion path เพิ่มด้วย | ส่ง null, scalar, array, malformed fields ผ่านแต่ละ transport แล้วไม่มี unhandled exception/process exit และ request ผิดรูปแบบถูก reject |
| P2 / R5 | PWA ไม่มี handshake deadline/pong watchdog/automatic reconnect ใน gateway; หาก socket ไม่ส่ง handshake อาจค้าง Connecting ซึ่งปุ่ม Connect ถูก disable นอกจากนี้ late-joining iPad ไม่ได้รับ edaConnected ล่าสุด เพราะ DO ส่งเพียง vpsConnected ตอนเข้าร่วม | `src/lib/gateway.ts`, `worker/index.ts`, `src/App.tsx`: timeout/cancel, heartbeat health, bounded reconnect, เก็บหรือขอสถานะ bridge ล่าสุด; invalidate state เมื่อ VPS/bridge offline แม้ relay ยัง online | handshake ไม่มา, sleep/wake, network เปลี่ยน, bridge restart, iPad เข้าใหม่หลัง VPS พร้อม ต้องแสดงสถานะจริงและกู้การเชื่อมต่อได้โดยไม่ replay mutation |
| P2 / R6 | `pendingRelayIds` ใน agent เพิ่มทุก execute แต่ลบเมื่อมี result/error หรือ local disconnect เท่านั้น หาก bridge ไม่ตอบแต่ connection ยังอยู่ browser timeout ไม่ได้ล้าง Set นี้ | `companion/cloud-agent.mjs`: TTL, max in-flight, cleanup และ generation-aware response routing; timeout ไม่ควรตีความว่าคำสั่งถูกยกเลิกบน EasyEDA แล้ว | ส่ง request ไม่ตอบจำนวนมาก memory อยู่ในเพดาน, pending หมดอายุ และ late result ไม่ทำให้ retry ซ้ำ |
| P2 / R7 | Toolbar ชื่อ Wire/Route/Via/Text และ demo-board อาจทำให้เข้าใจว่ากำลังแก้วงจรจริง | `src/App.tsx`, README: ระบุ preview ให้ชัด ปิดหรือซ่อนเครื่องมือที่ยังไม่ implement และแยก local preview fit กับ EasyEDA fit | ผู้ทดสอบแยกได้ว่าอะไรเป็น live state และอะไรเป็น preview; ไม่มีเครื่องมือดูพร้อมใช้งานแต่ไม่เกิดงานจริง |
| P2 / R8 | ไม่มี dependency lockfile ใน tree ที่ตรวจ; CI ใช้ npm install และ package version ranges ทำให้ dependency เปลี่ยนได้ข้ามการรัน; CI transport ฝั่ง companion เป็น syntax check เท่านั้น | `package.json`, lockfile ใหม่, `.github/workflows/ci.yml`: pin dependency resolution และใช้ npm ci; เพิ่ม behavioral integration tests สำหรับ Worker/agent/gateway | clean install reproducible และทดสอบ auth, routing แยก client, disconnect, malformed envelope, payload bounds, DO lifecycle ได้ |

### ขอบเขตความเชื่อถือที่ต้องบันทึกก่อนรองรับหลายคน

จาก `worker/index.ts` และ `companion/cloud-agent.mjs`: ผู้ถือ IPAD_TOKEN สามารถส่ง execute code ผ่าน relay ได้ โดย server ตรวจรูปแบบและขนาด แต่ไม่ได้จำกัดเฉพาะคำสั่ง read-only ของ UI. ดังนั้นคำว่า Phase 7 read-only หมายถึง command/UI ของ feature นั้น ไม่ใช่ permission boundary ของ backend

ปัจจุบัน IPAD_TOKEN/VPS_TOKEN เป็น secrets ระดับ deployment และ session name ใช้แบ่ง routing ไม่ใช่สิทธิ์ผู้ใช้ราย session. เหมาะกับ trusted-operator model; ก่อนขยายเป็นหลายผู้ใช้ควรวางแผน session-scoped authorization, bounded operation protocol/allowlist ฝั่งที่เชื่อถือได้, rate/in-flight limits และ log ที่ไม่เปิดเผย tokens. หากยังคง raw execute ให้ระบุ trust model ชัดเจน ห้ามอ้างว่าเป็น read-only account

WebSocket token อยู่ใน query string และ Direct/LAN URL ซึ่งอาจมี token ถูกเก็บใน localStorage (`src/App.tsx`). งานภายหลังควรทบทวน token lifetime/rotation, URL log redaction และการเก็บ credential; ไม่บันทึกค่า secret จริงลง handoff

### สิ่งที่ควรเพิ่มตามลำดับ

1. **แก้ R1–R4 และเพิ่ม regression tests ที่พิสูจน์ failure path** ก่อนเพิ่ม write capability; พิจารณา R5–R8 เป็น reliability milestone แยกให้ review ง่าย
2. **Phase 7: selected PCB/footprint component inspector แบบ read-only** ตาม specification ด้านบน เสริม expected document UUID/tab, explicit units, unsupported/not-component/no-selection/multi-selection/loading/error/stale states. ต้องมี test ว่าไม่มี mutation API และไม่แสดงข้อมูล component จากเอกสารก่อนหน้า
3. **ทดสอบระบบจริงครบสาย** บน iPad Safari และ Home Screen PWA, แนวตั้ง/แนวนอน, touch/Pencil/keyboard, sleep/wake, VPS restart และ EasyEDA bridge restart. จด app commit, EasyEDA/Gateway version, iPadOS/browser version, เวลา และผลรายกรณี ไม่ใส่ secret
4. **กำหนดทางเลือกสำหรับภาพบอร์ดจริง** ตรวจ public API ว่ารองรับข้อมูล geometry หรือ preview ใดบ้าง แล้วทำ read-only viewer proof of concept ก่อน hit testing/selection จาก canvas. อย่าอ้างว่ามี live editor จนเปลี่ยนเอกสารแล้วรูปทรง/ชิ้นส่วนบน iPad ตรงกับ EasyEDA จริง
5. **ทบทวน PR #5 แยก phase ภายหลัง** เปรียบเทียบกับ main ใหม่, ตรวจ BETA API/version/units/locks/document identity, สำรอง test project, กำหนดวิธีกู้คืนและผลเมื่อ timeout. ต้องมี explicit editing scope ก่อนย้าย/หมุน ไม่ merge เพียงเพราะ CI ผ่าน
6. **ปรับโครงสร้าง UI เมื่อเริ่มเพิ่ม inspector** แยก connection/session lifecycle, document browser และ inspector จาก App.tsx เพื่อลดโอกาส state ผิดพลาด ไม่ทำ refactor ใหญ่ปนกับ correction โดยไม่มีเหตุ
7. **Deployment/runbook** เติมขั้นตอนตรวจ health เทียบกับ end-to-end readiness, service restart, token rotation, rollback และ logs. CI ปัจจุบันมี Wrangler dry-run ไม่ใช่หลักฐานการ deploy; ยังไม่ได้ตรวจการตั้งค่า Cloudflare Builds ภายนอก repo

### เกณฑ์ปิดงานในอนาคต

- โค้ดตรง scope ที่ผู้ใช้สั่ง; Phase 7 ต้องไม่มี geometry mutation
- มีหลักฐาน tests/build/Worker checks ที่ commit สุดท้ายของงานนั้น พร้อมระบุว่าการทดสอบ live ทำหรือยัง
- README/version/HANDOFF ตรงกับสิ่งที่ merge จริง; งานค้างใน PR ต้องแยกชัด
- บันทึก unresolved findings และ next action โดยไม่ประกาศว่าฟีเจอร์พร้อม production จาก CI เพียงอย่างเดียว
- การ review รอบนี้จบที่ HANDOFF เท่านั้น: **ยังไม่ได้แก้ R1–R8, เริ่ม Phase 7, เปลี่ยน PR #5 หรือ deploy**
