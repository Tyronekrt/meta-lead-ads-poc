# Meta setup guide — App, Page, Lead Form, Webhook, Testing Tool (~30 min, free)

You need: a Facebook account, a test Page you admin, no ad spend.

## 1. Create the Facebook App

1. Go to https://developers.facebook.com/apps → **Create App** → type **Business**.
2. App name e.g. `UnQue Lead PoC`. Note the **App ID** and **App Secret**
   (Settings → Basic).
3. Add product **Webhooks** (Add Product → Set Up).

## 2. Create a test Page + Lead Form

1. Create a Page: https://www.facebook.com/pages/create (any category, e.g. "Test Business").
2. Create a Lead Form without ads via Graph API Explorer (https://developers.facebook.com/tools/explorer/):
   - Get a **Page Access Token** with permissions: `pages_show_list`, `pages_manage_metadata`, `leads_retrieval`, `pages_read_engagement`.
   - `POST /{page-id}/leadgen_forms` with e.g.:
     ```json
     { "name": "PoC Test Form", "locale": "en_US" }
     ```
   - Note the returned **form_id**. (Or create the form in Business Suite → Instant Forms — same result.)
3. Save the Page Access Token into `backend/.env` as `PAGE_ACCESS_TOKEN`.

## 3. Run + expose the backend

```bash
cd backend && npm install && npm run dev   # :3001
ngrok http 3001
# note the URL, e.g. https://abc123.ngrok-free.app
```

(Alternative without signup: `cloudflared tunnel --url http://localhost:3001`)

## 4. Subscribe the webhook

1. App Dashboard → **Webhooks** → **Page** → **Subscribe**:
   - Callback URL: `https://<yours>.ngrok-free.app/webhook`
   - Verify Token: exactly the `VERIFY_TOKEN` in `backend/.env` (`unque_poc_verify_123`)
   - Click **Verify and Save** — backend logs `Webhook verified OK`.
2. In the Page subscription row, tick **`leadgen`** and Subscribe.
3. Subscribe your Page to the App (one-off, via Graph Explorer with the Page token):
   ```
   POST /{page-id}/subscribed_apps  with  subscribed_fields=["leadgen"]
   ```
   Verify: `GET /{page-id}/subscribed_apps` lists your App ID.

## 5. Test with Meta's Lead Ads Testing Tool (the Loom moment)

1. Start the app (`cd mobile && npx expo start`), open **Live Leads**, keep it visible.
2. Open https://developers.facebook.com/tools/lead-ads-testing
3. Select your **Page** → select your **Form** → **Create Lead** / fill name, email, phone → submit.
4. Watch the backend log `leadgen webhook: { leadgenId … }` then `Broadcasting new-lead`.
5. The lead appears at the top of the phone screen in ~1–2 s — **do not touch the phone**.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Verify & Save → 403 | `VERIFY_TOKEN` mismatch; backend must be running + reachable via HTTPS |
| Webhook arrives but "Graph fetch failed" lead | `PAGE_ACCESS_TOKEN` missing/expired or lacking `leads_retrieval`; regenerate in Explorer |
| Testing Tool has no Page/Form | you must admin the Page; create the form under that same Page |
| App shows "socket disconnected" | wrong `BACKEND_URL` — Android emulator needs `10.0.2.2`, real phone needs laptop LAN IP, and backend must bind `0.0.0.0` (it does) |
| ngrok warns in browser | webhooks unaffected; for app-on-phone use LAN IP instead of ngrok URL |
| Lead slow (>5 s) | normal on first submit; submit once more on camera — second is instant. Keep a `curl /api/test-lead` ready as backup (disclose it, still proves the realtime path) |

## Moving to production (out of scope for PoC)

Persist leads in Postgres, verify `X-Hub-Signature-256` strictly, add auth on `/api/leads`, paginate history, handle token refresh + webhook retries idempotently (dedupe by `leadgen_id` — already done in-memory here).
