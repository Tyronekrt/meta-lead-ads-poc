# Node backend for Meta Lead Ads PoC

## Quick start
```bash
cd backend
cp .env.example .env   # then fill PAGE_ACCESS_TOKEN
npm install
npm run dev            # → http://localhost:3001/health
```

## Expose for Meta (Meta requires a public HTTPS URL)
```bash
# option A: ngrok
ngrok http 3001
# → https://XXXX.ngrok-free.app/webhook  (use this as Callback URL in App Dashboard)

# option B: cloudflared (no signup)
cloudflared tunnel --url http://localhost:3001
```

## Simulate a lead (no Meta needed)
```bash
curl -X POST http://localhost:3001/api/test-lead \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Aarav Sharma","email":"aarav@test.com","phone":"+91-99999-11111"}'
```
Watch it appear in the app instantly via Socket.IO `new-lead`.
