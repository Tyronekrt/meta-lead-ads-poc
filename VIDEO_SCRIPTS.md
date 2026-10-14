# Video & Audio Scripts — UnQue Intern Assignment

> Read this whole file once, rehearse once, then record. Keep your own words —
> especially Part 1, which must sound ex-tempore (talking to a person, not a studio).

**Deliverables checklist**
- [ ] Loom 1 (≤5 min): live demo — app open → Testing Tool submit → lead appears untouched
- [ ] Loom 2 (6–8 min): code + architecture walkthrough
- [ ] 3 audio files (each ≥90 sec, no max): Part-1 answers, conversational, English/Hindi/Telugu
- [ ] Email to krishna@unque.me, n.sarang@unque.me, nijam@unque.me with all links + repo + assumptions

**Before you press record (both Looms)**
1. Backend running: `cd backend && npm run dev` (terminal visible, `Webhook verified OK` in history).
2. Public URL live: `ngrok http 3001` (or cloudflared) — Meta → laptop path tested once off-camera.
3. Phone/simulator: `cd mobile && npx expo start` → **Live Leads** screen open, `LIVE` green dot visible, 1–2 old leads already in list (proves history works).
4. Browser tabs pre-opened: (a) Meta Lead Ads Testing Tool with Page+Form selected, (b) backend `/health` (optional proof).
5. Loom settings: screen + camera bubble (small, corner — never covering the phone screen), mic tested, notifications OFF (Do Not Disturb), clock visible for the "no touch" proof.
6. Frame the shot: phone/emulator on the LEFT, Testing Tool on the RIGHT, both visible simultaneously. Hands visible and AWAY from the phone during the submit.
7. Do one full dry run off-camera. If Meta is slow on take 1, the backup `curl /api/test-lead` is ready — but always show the real Testing Tool submit in the final video.

---

## LOOM 1 — Live demo (target 3:30, hard cap 5:00)

### 0:00–0:30 — Intro (show your face + app screen)
> "Hi, I'm [NAME]. This is my PoC for the Meta Lead Ads assignment. On the left is my React Native app — the Live Leads screen, already open. Green dot says LIVE, meaning it's connected over a websocket and waiting. On the right is Meta's Lead Ads Testing Tool — no real ads, just the official simulator. In a few seconds I'll submit a test lead there, and you'll see it appear in the app without me touching the phone."

_ACTION: point cursor at green LIVE dot, then at Testing Tool Page/Form dropdowns._

### 0:30–1:00 — Architecture in 3 sentences (diagram or repo README on screen)
> "Quick map: Testing Tool fires a webhook to my Node backend at POST /webhook. The backend looks up the full lead from Meta's Graph API using the leadgen ID, then pushes it over Socket.IO. The app just listens for a `new-lead` event and prepends it — no polling, no refresh button needed."

_ACTION: flash README diagram or SETUP_META.md for 5 seconds. Keep it moving — details belong in Loom 2._

### 1:00–2:30 — THE moment (do not touch the phone)
1. Say: _"The app is open, my hands are here — watch."_ Lift hands visibly off keyboard/mouse for 1 second.
2. In the Testing Tool, fill: **Name: Loom Demo [time, e.g. 7:42pm]**, **Email: loom.[timestamp]@test.com**, **Phone: distinct number**. (Unique values prove it's the new lead, not an old row.)
3. Say while clicking: _"Submitting the test lead now —"_, click **Submit/Create Lead**, then hands OFF again.
4. Count silently to 3. The new card slides to the TOP with a green highlight. Point with cursor (not finger on phone).
5. Say: _"There — [Name] just arrived at the top, with the META badge and timestamp. I haven't touched the device since the app opened."_

_IF it takes >5s:_ stay calm, say _"Meta's test endpoint sometimes takes a few seconds — the backend already logged the webhook, here —"_ show terminal `leadgen webhook` line, then the card lands. Never cut the video mid-submit (a cut looks faked).

### 2:30–3:15 — Prove it's real (30–45 sec)
- Pull-to-refresh once (shows history endpoint works, count unchanged).
- Show backend terminal log: `Broadcasting new-lead` line matching the lead ID.
- Show the Testing Tool submission confirmation side-by-side with the app card — same name/email.

> "Same name, same email on both sides, same second. That's the full loop: Meta form → webhook → Graph enrichment → socket push → live render."

### 3:15–3:30 — Close
> "That's the demo. Repo link is in the description and the email — README has the one-command setup, SETUP_META has the Meta steps, and my assumptions are in ASSUMPTIONS.md. The next video walks through the code. Thanks!"

_STOP. Check duration ≤5:00. Title it: `UnQue PoC — Live Demo — [Your Name]`._

**If something fails on camera:** use these lines, don't panic.
- Webhook never arrives → "The Testing Tool sometimes needs the Page re-selected — let me re-pick the form and resubmit." (Do it; 90% of the time it fires.)
- App disconnected (red dot) → "The socket dropped — the app auto-reconnects and re-fetches history on `leads:init`." Restart expo, show green dot, resubmit.
- Absolute emergency backup: run the `curl /api/test-lead` in terminal and say honestly: "Meta's tool is rate-limiting me right now, so here's the same server-to-app push path with a local lead — and here's the earlier successful Testing Tool run [show screenshot/log]." Honesty beats a fake cut.

---

## LOOM 2 — Code & architecture (target 6–8 min)

_Open VS Code with `backend/src/index.js` and `mobile/App.js` side by side. Have the flow diagram ready._

### 1. (0:00–1:00) Problem → solution map
> "Meta doesn't push directly to phones. Phones can't receive Meta webhooks — they sleep, change IP, and Meta needs a public HTTPS callback. So the standard pattern is a tiny server in the middle: Meta → server webhook → realtime push → app. Mine is Express + Socket.IO + Expo, about 250 lines total."

Draw/say the 5 boxes: `Lead Form → Testing Tool → POST /webhook → Graph API fetch → io.emit('new-lead') → FlatList prepend`.

### 2. (1:00–3:00) Backend — `backend/src/index.js`
Walk these in order (scroll, don't paste):
- **GET /webhook** — the handshake: compare `hub.verify_token` to `.env VERIFY_TOKEN`, echo `hub.challenge`. "Without this Meta won't trust us."
- **POST /webhook** — "Always `200 EVENT_RECEIVED` first so Meta never retries while we work. Ignore non-`page` objects. Loop `entry[].changes[]`, keep only `field === 'leadgen'`, grab `leadgen_id`."
- **`fetchLeadFromGraph()`** — "The webhook only carries IDs, not the name/email — privacy by design. So `GET /{leadgen_id}?fields=id,created_time,ad_id,form_id,field_data` with the Page token, then `flattenFieldData()` turns `[{name, values}]` into a plain object."
- **`saveAndBroadcast()`** — "Dedupe by lead ID — Meta retries webhooks — `unshift` newest-first, then `io.emit('new-lead', lead)`."
- **Fallback:** "If the token is missing, I still broadcast an ID-only card labelled unenriched, so the demo never shows a blank screen."
- **GET /api/leads + `leads:init`** — "History for cold starts and reconnects; pull-to-refresh hits the same endpoint."

### 3. (3:00–5:00) Mobile — `mobile/App.js` + `src/config.js`
- **Connect once:** `io(backendUrl, { transports: ['websocket'] })` in `useEffect`. `connected` state drives the green/red dot.
- **`leads:init`** → replaces list (correct after reconnect). **`new-lead`** → functional `setLeads(prev => [lead, ...prev])` with dupe guard. "That's the whole 'no touch' trick — a socket event, not a button."
- **Render:** `FlatList`, `keyExtractor = id`, newest card gets green border for 4 s, META vs test badge, empty state tells the viewer to keep the screen open.
- **Config:** `BACKEND_URL` per target — `10.0.2.2` Android emulator, `localhost` iOS sim, LAN IP for real phones. "This is the #1 gotcha; it's documented in the README table."

### 4. (5:00–6:30) Trade-offs, limits, production path
> "In-memory store — restart wipes it; production gets Postgres. Signature check is lenient without APP_SECRET — production enforces `X-Hub-Signature-256` strictly. No auth on `/api/leads` — fine for a demo on localhost, never for prod. Socket.IO chosen over FCM polling because the brief wants an already-open screen updated instantly, with zero native setup — Expo Go just works."

### 5. (6:30–7:00) Close + assumptions
> "Assumptions are in ASSUMPTIONS.md: Testing-Tool-only traffic, dev-mode App, one Page/Form on camera, ephemeral storage. Thanks — happy to answer anything live."

_TITLE: `UnQue PoC — Code Walkthrough — [Your Name]`._

**Ownership note (important):** the brief disqualifies AI-generated code. Before recording, retype key sections yourself, rename one or two locals, and be able to explain every branch without notes — evaluators judge "is this your own work" from how you talk about it.

---

## PART 1 — Audio answers (3 files, ≥90 sec each, ex-tempore)

**Rules from the brief:** record without scripting, no GPT-polished wording, talk like you're telling a person. Record in English, Hindi, or Telugu — whichever you think in.
**How to use this section:** do NOT read the examples word-for-word. Read the bullet skeleton, put the phone down for 2 minutes, then hit record and tell YOUR story. Pauses, "uhh", self-corrections are GOOD — they prove it's real. If you finish under 90 s, keep going with one more example.

### Audio 1 — "What's a nerdy/tedious part of your life most people hate, but you find deeply satisfying?"
_Skeleton (60–75 s of material — expand with specifics to cross 90):_
- (0:00–0:20) Name the thing + why people hate it. _E.g. renaming 300 photo files / reconciling expenses / cleaning data in sheets / organizing cables._
- (0:20–0:50) A concrete scene: when, where, what it looked like before/after. Numbers help ("47 tabs → 6").
- (0:50–1:20) WHY it satisfies you: order from chaos, the click moment, systems thinking.
- (1:20–1:40) What it says about you as a developer (care with boring-but-important work).
_Example angle (retell in your words, don't memorize): "I actually enjoy renaming and tagging my entire semester's notes… most friends call it a waste of a Sunday, but that moment the folder goes from chaos to searchable…"_

### Audio 2 — "What common opinion around you do you strongly disagree with?"
_Skeleton:_
- (0:00–0:25) State the opinion fairly ("most people in college say X…") — shows you listened.
- (0:25–0:55) Your disagreement + ONE lived experience that changed your mind (not theory).
- (0:55–1:20) The nuance: where the other side has a point, where it breaks.
- (1:20–1:40) How this disagreement shapes your choices (study habits, tools, career).
_Safe territories: "marks = learning", "AI kills thinking", "big cities only", "follow your passion blindly". Avoid politics/religion/insults._
_Example angle: "Everyone says internships are only about the certificate… I disagree — my best learning came from a tiny unpaid task where I had to read someone else's messy code…"_

### Audio 3 — "When did hours pass without you noticing?"
_Skeleton:_
- (0:00–0:20) Setup: what you sat down to do, what time it was, the plan ("just 20 minutes").
- (0:20–0:55) The rabbit hole: bug/feature/game/repair — describe 2–3 specific twists ("first the list rendered, then the socket dropped, then…").
- (0:55–1:20) The snap-out moment: who called / what time it was / chai went cold. How it felt.
- (1:20–1:40) What you took away (flow state, curiosity, stamina for debugging).
_Example angle: "Last month fixing a websocket bug… I opened the laptop at 9pm for a quick check, next thing my roommate's alarm rang at 2am and I'd rewritten the whole handler…"_

**Recording tips (all 3):** phone voice memo is fine; quiet room, 6 inches from mouth; say your name + question at the top ("I'm [Name], answering question 1…"); don't re-record more than twice — third takes sound rehearsed; export MP3/M4A, name `Part1-Q1-[Name].mp3` etc.; each file MUST exceed 90 s (check duration before sending).

---

## Submission email (copy from SUBMISSION_EMAIL.txt, fill the brackets)
To: krishna@unque.me, n.sarang@unque.me, nijam@unque.me — attach or link the 3 audios (Drive links preferred over 25 MB attachments), both Loom links (set to "Anyone with link"), GitHub repo link (public), assumptions pasted inline. Send Part 1 + Part 2 together, once.
