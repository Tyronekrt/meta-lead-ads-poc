# Meta Lead Ads → React Native Live PoC (UnQue Intern Assignment)

When a user submits a Meta Lead Ad form, the lead appears **live** in an
already-open React Native screen — no refresh, no tap on the device.

```
Meta Lead Form submit
  → Meta Lead Ads Testing Tool (simulates a real submission)
  → POST /webhook on this backend (Meta Webhooks: Page → leadgen)
  → backend fetches full lead via Graph API (leadgen_id → field_data)
  → Socket.IO emits `new-lead`
  → React Native app prepends it to the FlatList instantly
```

Demo video shows exactly this: app open on simulator/phone → submit in Meta's
Testing Tool → lead slides into the list untouched.

## Repo layout

```
meta-lead-ads-poc/
├── backend/            # Express + Socket.IO webhook receiver & broadcaster
│   ├── src/index.js    # all routes: /webhook, /api/leads, /api/test-lead, /health
│   └── .env.example
├── mobile/             # Expo React Native app (single "Live Leads" screen)
│   ├── App.js
│   └── src/config.js   # BACKEND_URL — edit for emulator vs real phone
├── SETUP_META.md       # step-by-step: Facebook App, Page, webhook, testing tool
├── ASSUMPTIONS.md
├── VIDEO_SCRIPTS.md    # word-for-word scripts for both Loom videos + Part-1 audios
└── SUBMISSION_EMAIL.txt
```

## 5-minute quick start (local, no Meta needed)

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npm run dev          # → http://localhost:3001/health

# 2. Mobile (new terminal)
cd mobile
npm install
npx expo start       # scan QR with Expo Go, or press `a` (Android) / `i` (iOS)
```

Set the backend URL before running (see `mobile/src/config.js`):

| Running on            | BACKEND_URL               |
|-----------------------|---------------------------|
| Android emulator      | `http://10.0.2.2:3001` (default) |
| iOS simulator         | `http://localhost:3001`   |
| Physical phone (same Wi-Fi) | `http://<LAPTOP_LAN_IP>:3001` |

Simulate a lead (same realtime path as Meta):

```bash
curl -X POST http://localhost:3001/api/test-lead \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Aarav Sharma","email":"aarav@test.com","phone":"+91-99999-11111"}'
```

It appears in the open app within ~1 second via the `new-lead` socket event.

## Real Meta path (for the Loom demo)

Full steps in **SETUP_META.md**. Short version:

1. Create a Facebook App + a test Page + a Lead Form (all free, no ads).
2. Expose backend publicly: `ngrok http 3001` (or `cloudflared tunnel --url http://localhost:3001`).
3. In App Dashboard → Webhooks → Page → Subscribe with:
   - Callback URL: `https://<you>.ngrok-free.app/webhook`
   - Verify token: value of `VERIFY_TOKEN` in `backend/.env`
   - Field: `leadgen`
4. Subscribe your Page to the App, add a Page Access Token (`leads_retrieval`) to `.env`.
5. Open the app, keep the leads screen visible.
6. Open **Meta's Lead Ads Testing Tool** → pick Page + Form → fill → submit → watch the app.

## API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | health check |
| GET | `/webhook` | Meta verification handshake |
| POST | `/webhook` | Meta leadgen events (ACKs 200, enriches via Graph, emits socket) |
| GET | `/api/leads` | history for app launch / pull-to-refresh |
| POST | `/api/test-lead` | local simulation through the same broadcast path |

Socket events: `leads:init` (history on connect), `new-lead` (live push).

## Verified working

- `GET /webhook` verification handshake → echoes `hub.challenge` ✅
- `POST /webhook` with Meta-style payload → broadcasts (Graph-enriched, or ID-only fallback) ✅
- `POST /api/test-lead` → instant socket push ✅
- Socket client receives `leads:init` + `new-lead` ✅
- `npx expo export -p web` bundles cleanly ✅
