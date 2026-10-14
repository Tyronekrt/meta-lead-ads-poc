/**
 * Meta Lead Ads PoC — Webhook receiver + Realtime broadcaster
 *
 * Flow:
 *  1. Meta sends POST /webhook when a lead is submitted (Page -> leadgen).
 *     Payload: { object: 'page', entry: [{ id, time, changes: [{ field: 'leadgen', value: { leadgen_id, page_id, form_id, ... } }] }] }
 *  2. We fetch full lead data from Graph API: GET /{leadgen_id}?fields=id,created_time,ad_id,form_id,field_data
 *  3. We normalise + store in-memory and broadcast via Socket.IO event `new-lead`.
 *  4. React Native app listens for `new-lead` and prepends it to the list — no refresh needed.
 *
 * Also provides:
 *  - GET  /webhook  → verification handshake for Meta App Dashboard
 *  - GET  /api/leads → list all received leads (used by app on launch / pull-to-refresh)
 *  - POST /api/test-lead → simulate a Meta test lead locally (same code path, no Meta needed)
 *  - GET  /health → health check
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'unque_poc_verify_123';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const APP_SECRET = process.env.APP_SECRET || '';
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v21.0';

// In-memory store (PoC: resets on restart — fine for demo; swap for DB in production)
const leads = [];
let seq = 0;

const app = express();
app.use(cors({ origin: '*' }));

// IMPORTANT: keep raw body for signature verification, then parse JSON.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ---------- helpers ----------

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

/** Verify X-Hub-Signature-256 if APP_SECRET is configured (Meta signs webhook POSTs). */
function isValidSignature(req) {
  if (!APP_SECRET) return true; // skip verification for PoC if no secret set
  const sig = req.headers['x-hub-signature-256'] || '';
  const expected =
    'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody || '').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Convert Graph API field_data [{name, values:[...]}] → flat object {name: value}. */
function flattenFieldData(fieldData = []) {
  const out = {};
  for (const f of fieldData) {
    if (f && f.name) out[f.name] = (f.values && f.values[0]) ?? '';
  }
  return out;
}

/** Normalise a lead into the shape the mobile app renders. */
function toLeadObject({ leadgenId, pageId, formId, adId, createdTime, fields, source }) {
  seq += 1;
  return {
    id: leadgenId || `local-${Date.now()}-${seq}`,
    seq: seq,
    full_name: fields.full_name || fields.fullname || fields.name || '',
    email: fields.email || '',
    phone: fields.phone_number || fields.phone || fields.phone_number_ || '',
    // keep everything else so the demo can show arbitrary form fields
    fields,
    page_id: pageId || '',
    form_id: formId || '',
    ad_id: adId || '',
    created_time: createdTime || new Date().toISOString(),
    received_at: new Date().toISOString(),
    source: source || 'meta-webhook', // 'meta-webhook' | 'test-tool' | 'local-simulate'
    raw_leadgen_id: leadgenId || '',
  };
}

function saveAndBroadcast(lead) {
  // dedupe by lead id (Meta retries webhooks)
  if (leads.some((l) => l.id === lead.id)) {
    log('Duplicate lead ignored:', lead.id);
    return leads.find((l) => l.id === lead.id);
  }
  leads.unshift(lead);
  log('Broadcasting new-lead:', lead.id, JSON.stringify(lead.fields));
  io.emit('new-lead', lead);
  return lead;
}

/** Fetch full lead from Meta Graph API using the leadgen_id from the webhook. */
async function fetchLeadFromGraph(leadgenId) {
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.includes('PASTE_YOUR')) {
    throw new Error(
      'PAGE_ACCESS_TOKEN is not configured. Set it in .env (Graph API Explorer → Page token with leads_retrieval).'
    );
  }
  const params = new URLSearchParams({
    fields: 'id,created_time,ad_id,form_id,field_data',
    access_token: PAGE_ACCESS_TOKEN,
  });
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Graph API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ---------- routes ----------

app.get('/health', (_req, res) => {
  res.json({ ok: true, leads: leads.length, time: new Date().toISOString() });
});

/**
 * Meta webhook verification.
 * In App Dashboard > Webhooks > Page > Subscribe, Meta sends:
 *   GET /webhook?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
 * We must echo hub.challenge when verify_token matches.
 */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  log('Webhook verification attempt:', { mode, token });
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    log('Webhook verified OK');
    return res.status(200).send(challenge);
  }
  log('Webhook verification FAILED');
  return res.sendStatus(403);
});

/**
 * Meta webhook receiver — called on every lead submission (incl. Lead Ads Testing Tool).
 * Must respond 200 quickly or Meta retries.
 */
app.post('/webhook', async (req, res) => {
  // Always ACK first so Meta doesn't retry while we fetch from Graph.
  res.status(200).send('EVENT_RECEIVED');

  if (req.body.object !== 'page') {
    log('Ignoring non-page webhook object:', req.body.object);
    return;
  }
  if (!isValidSignature(req)) {
    log('WARNING: invalid X-Hub-Signature-256 — processing anyway for PoC');
  }

  const entries = req.body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'leadgen') continue;
      const v = change.value || {};
      const leadgenId = v.leadgen_id;
      const pageId = v.page_id || entry.id;
      const formId = v.form_id;
      log('leadgen webhook:', { leadgenId, pageId, formId });
      if (!leadgenId) continue;

      try {
        const graphLead = await fetchLeadFromGraph(leadgenId);
        const fields = flattenFieldData(graphLead.field_data);
        const lead = toLeadObject({
          leadgenId: String(graphLead.id || leadgenId),
          pageId,
          formId: graphLead.form_id || formId,
          adId: graphLead.ad_id,
          createdTime: graphLead.created_time,
          fields,
          source: 'meta-webhook',
        });
        saveAndBroadcast(lead);
      } catch (err) {
        // If Graph fetch fails (e.g. missing token in demo), still show *something* live
        // so the Loom demo never stalls — mark it clearly as unenriched.
        log('Graph fetch failed, broadcasting ID-only lead:', err.message);
        const lead = toLeadObject({
          leadgenId: String(leadgenId),
          pageId,
          formId,
          fields: { _note: 'Graph fetch failed: ' + err.message },
          source: 'meta-webhook-unenriched',
        });
        saveAndBroadcast(lead);
      }
    }
  }
});

/** Return all leads (newest first). App calls this on launch + pull-to-refresh. */
app.get('/api/leads', (_req, res) => {
  res.json({ count: leads.length, leads });
});

/**
 * Simulate a lead locally — runs through the SAME saveAndBroadcast path as real webhooks.
 * Used for: (a) testing without Meta setup, (b) backup during Loom if Meta is slow.
 * Body: { full_name, email, phone, ...anyExtraFields }
 */
app.post('/api/test-lead', (req, res) => {
  const body = req.body || {};
  const { full_name, name, email, phone, phone_number, ...rest } = body;
  const fields = {
    full_name: full_name || name || `Test User ${seq + 1}`,
    email: email || `test${Date.now()}@example.com`,
    phone_number: phone || phone_number || '+91-98765-43210',
    ...rest,
  };
  const lead = toLeadObject({
    leadgenId: `test-${Date.now()}`,
    pageId: 'test-page',
    formId: 'test-form',
    createdTime: new Date().toISOString(),
    fields,
    source: 'local-simulate',
  });
  saveAndBroadcast(lead);
  res.status(201).json(lead);
});

/** Accept a raw Meta Testing-Tool-style payload directly (useful for curl demos). */
app.post('/api/meta-test-payload', async (req, res) => {
  // Lets you paste the exact JSON Meta sends and watch it flow through.
  // Re-dispatch internally by calling the same logic as /webhook.
  req.url = '/webhook';
  res.status(200).send('EVENT_RECEIVED (simulated)');
  const v = (req.body?.entry?.[0]?.changes?.[0]?.value) || {};
  if (v.leadgen_id && PAGE_ACCESS_TOKEN && !PAGE_ACCESS_TOKEN.includes('PASTE_YOUR')) {
    try {
      const g = await fetchLeadFromGraph(v.leadgen_id);
      saveAndBroadcast(
        toLeadObject({
          leadgenId: String(g.id),
          pageId: v.page_id,
          formId: g.form_id || v.form_id,
          adId: g.ad_id,
          createdTime: g.created_time,
          fields: flattenFieldData(g.field_data),
          source: 'test-tool',
        })
      );
    } catch (e) {
      log('meta-test-payload fetch failed:', e.message);
    }
  }
});

// ---------- sockets ----------

io.on('connection', (socket) => {
  log('Socket connected:', socket.id);
  // Send current history so a freshly opened app instantly shows existing leads.
  socket.emit('leads:init', leads);
  socket.on('disconnect', () => log('Socket disconnected:', socket.id));
});

// ---------- start ----------

server.listen(PORT, '0.0.0.0', () => {
  log(`Backend listening on http://0.0.0.0:${PORT}`);
  log(`Webhook verify endpoint: GET /webhook (VERIFY_TOKEN=${VERIFY_TOKEN ? 'set' : 'MISSING'})`);
  log(`Health: GET /health | Leads: GET /api/leads | Simulate: POST /api/test-lead`);
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.includes('PASTE_YOUR')) {
    log('NOTE: PAGE_ACCESS_TOKEN not set — real Meta enrichment disabled; ID-only + /api/test-lead still work.');
  }
});

module.exports = { app, flattenFieldData, toLeadObject };
