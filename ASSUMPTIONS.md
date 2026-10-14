# Assumptions

1. **No real ads.** Per the brief, only Meta's **Lead Ads Testing Tool** traffic is used. No ad account, campaign, or spend exists; test leads (`ad_id` empty/zero) are expected and treated as first-class leads.
2. **Meta App in Development mode is sufficient.** Webhooks + Testing Tool work without App Review for admins/testers of the App. Production would require `leads_retrieval` App Review.
3. **Single Page + single Form** for the demo. The backend stores `page_id`/`form_id` per lead, so multi-form works, but the Loom shows one form to stay under 5 minutes.
4. **Ephemeral storage.** Leads live in server memory (newest-first array, deduped by `leadgen_id`). Restart clears history — acceptable for a PoC; README notes the Postgres swap.
5. **Realtime via WebSocket (Socket.IO), not polling.** The app never polls; it renders `leads:init` on connect and `new-lead` pushes. Pull-to-refresh only re-fetches history as a safety net. This satisfies "without any manual action on the device".
6. **Lead enrichment needs a Page Access Token.** The webhook itself carries only `leadgen_id`; full name/email/phone require `GET /{leadgen_id}` with a token holding `leads_retrieval`. If the token is missing/expired the backend still broadcasts an ID-only card (clearly labelled) so the demo never stalls — full enrichment resumes once the token is set.
7. **Network.** Phone/simulator and laptop share a network (or ngrok for Meta → laptop). Expo Go on the same Wi-Fi, or emulators with `10.0.2.2`/`localhost` mapping, per `mobile/src/config.js`.
8. **One-screen app is intentional.** The brief asks for "the leads list screen already open" — a single focused screen demonstrates this best; no auth/navigation to distract from the realtime moment.
9. **Timestamps are server receipt time + Meta `created_time`** (both shown); timezones render in device locale.
