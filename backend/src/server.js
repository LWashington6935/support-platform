// backend/src/server.js
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import Database from 'better-sqlite3';
import OpenAI from 'openai';

/* -------------------- Windows-safe paths -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');          // backend/
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DB_FILE = path.join(DATA_DIR, 'support.db');

/* -------------------- utils -------------------- */
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
const nowISO = () => new Date().toISOString();
const toArray = (v) => {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); if (Array.isArray(j)) return j; } catch {}
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};
const uniq = (arr) => Array.from(new Set(arr || []));

/* -------------------- storage bootstrap -------------------- */
ensureDir(DATA_DIR);
ensureDir(PUBLIC_DIR);

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
/* -------- Tickets / Messages / CSAT -------- */
CREATE TABLE IF NOT EXISTS tickets (
  id              INTEGER PRIMARY KEY,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'web',
  requester_email TEXT NOT NULL,
  requester_name  TEXT,
  status          TEXT NOT NULL DEFAULT 'new',
  priority        TEXT NOT NULL DEFAULT 'normal',
  category        TEXT,
  sentiment       TEXT,
  sla_due_at      TEXT,
  tags            TEXT,
  ai_suggestion   TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY,
  ticket_id   INTEGER NOT NULL,
  author_type TEXT NOT NULL, -- 'agent' | 'requester' | 'system'
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  FOREIGN KEY(ticket_id) REFERENCES tickets(id)
);
CREATE TABLE IF NOT EXISTS csat (
  id          INTEGER PRIMARY KEY,
  ticket_id   INTEGER NOT NULL,
  rating      INTEGER NOT NULL,
  comment     TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY(ticket_id) REFERENCES tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status  ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(updated_at);

/* -------- Knowledge Base (KB) -------- */
CREATE TABLE IF NOT EXISTS kb_articles (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  tags        TEXT,              -- JSON array of strings (optional)
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

/* Full-text search over articles */
CREATE VIRTUAL TABLE IF NOT EXISTS kb_articles_fts
USING fts5(title, body, content='kb_articles', content_rowid='id');

/* Keep FTS index in sync */
CREATE TRIGGER IF NOT EXISTS kb_ai AFTER INSERT ON kb_articles BEGIN
  INSERT INTO kb_articles_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
CREATE TRIGGER IF NOT EXISTS kb_ad AFTER DELETE ON kb_articles BEGIN
  INSERT INTO kb_articles_fts(kb_articles_fts, rowid, title, body)
  VALUES('delete', old.id, old.title, old.body);
END;
CREATE TRIGGER IF NOT EXISTS kb_au AFTER UPDATE ON kb_articles BEGIN
  INSERT INTO kb_articles_fts(kb_articles_fts, rowid, title, body)
  VALUES('delete', old.id, old.title, old.body);
  INSERT INTO kb_articles_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
`);

/* ---- Seed KB on first run (safe idempotent) ---- */
const kbCount = db.prepare(`SELECT COUNT(*) AS c FROM kb_articles`).get().c;
if (kbCount === 0) {
  const insKB = db.prepare(
    `INSERT INTO kb_articles (title, body, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const now = nowISO();
  const seed = [
    {
      title: 'Track your order',
      body: 'Visit Orders → Enter your email and order number. If the carrier shows “label created”, allow 24–48 hours for the first scan.',
      tags: JSON.stringify(['shipping','orders','tracking'])
    },
    {
      title: 'Start a return or exchange',
      body: 'We accept returns within 30 days. Use the Returns Portal to get a prepaid label. Refunds post 3–5 business days after we receive it.',
      tags: JSON.stringify(['returns','refund','exchange'])
    },
    {
      title: 'Troubleshoot connection issues',
      body: 'Power cycle the device, reseat cables, and factory reset. Check firmware is current. If issues persist, send a 30s video of the behavior.',
      tags: JSON.stringify(['troubleshooting','connectivity','firmware'])
    }
  ];
  const tx = db.transaction(() => {
    seed.forEach(s => insKB.run(s.title, s.body, s.tags, now, now));
  });
  tx();
}

/* -------------------- OpenAI (Responses API) -------------------- */
const apiKey = process.env.OPENAI_API_KEY || '';
const keyType =
  !apiKey ? 'missing'
  : apiKey.startsWith('sk-proj-') ? 'project'
  : apiKey.startsWith('sk-') ? 'user'
  : 'unknown';

if (keyType === 'missing') {
  console.log('ℹ️  OPENAI_API_KEY not set — AI suggestions are disabled.');
} else if (keyType === 'project') {
  console.warn('⚠️  Using a project key (sk-proj-…). Server-to-server calls expect a standard API key (sk-…).');
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

async function callOpenAI(prompt) {
  const started = Date.now();
  try {
    const resp = await openai.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      input: prompt
    });
    const text = (resp.output_text || '').trim();
    console.log(`🧠 OpenAI ok in ${Date.now() - started}ms, ${text.length} chars`);
    return { ok: true, text };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error(`🧠 OpenAI error after ${Date.now() - started}ms: ${msg}`);
    return { ok: false, error: msg };
  }
}

async function buildAiSuggestion(ticket) {
  if (!openai) return null;

  const subject = ticket.subject || '';
  const body = ticket.body || '';
  const category = ticket.category || 'general';

  const prompt =
    `You are a concise, helpful customer support agent.\n` +
    `Ticket:\nSubject: ${subject}\nCategory: ${category}\nBody:\n${body}\n\n` +
    `Write a short, empathetic 3–5 sentence reply with next steps and any clarifying question.`;

  const r = await callOpenAI(prompt);
  if (r.ok && r.text) return r.text;

  // Fallback so UI shows a panel with why it failed
  return `[AI unavailable: ${r.error}]`;
}

/* -------------------- express app -------------------- */
const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

const upload = multer({ dest: path.join(DATA_DIR, 'uploads') }); // ready if you need attachments later

/* -------------------- demo macros -------------------- */
const MACROS = [
  { id: 1, name: 'Shipping delay apology', body: 'Sorry about the delay! We’ve escalated with our carrier. Please allow 24–48h. We’ll keep you posted and refund shipping if it misses the new ETA.' },
  { id: 2, name: 'Refund policy', body: 'We can refund to the original payment method within 3–5 business days once the item is received back. I’ve sent a return label. Let me know if you need a pickup.' },
  { id: 3, name: 'Troubleshooting basics', body: 'Please try: 1) power cycle, 2) reseat cables, 3) factory reset. If that doesn’t help, share a short video and your device firmware version.' },
];

/* -------------------- prepared statements -------------------- */
// tickets
const insTicket = db.prepare(`
  INSERT INTO tickets (
    subject, body, channel, requester_email, requester_name,
    status, priority, category, sentiment, sla_due_at, tags,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getTicket       = db.prepare(`SELECT * FROM tickets WHERE id = ?`);
const listTickets     = db.prepare(`SELECT * FROM tickets ORDER BY datetime(updated_at) DESC`);
const updTicketStatus = db.prepare(`UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`);
const updTicketTags   = db.prepare(`UPDATE tickets SET tags = ?, updated_at = ? WHERE id = ?`);
const updTicketAi     = db.prepare(`UPDATE tickets SET ai_suggestion = ?, updated_at = ? WHERE id = ?`);
// messages
const insMsg   = db.prepare(`INSERT INTO messages (ticket_id, author_type, body, created_at) VALUES (?, ?, ?, ?)`);
const listMsgs = db.prepare(`SELECT * FROM messages WHERE ticket_id = ? ORDER BY datetime(created_at) ASC`);
// csat
const insCsat = db.prepare(`INSERT INTO csat (ticket_id, rating, comment, created_at) VALUES (?, ?, ?, ?)`);
// kb
const getKB    = db.prepare(`SELECT * FROM kb_articles WHERE id = ?`);
const listKB   = db.prepare(`SELECT id, title, substr(body,1,240) AS excerpt, tags, updated_at FROM kb_articles ORDER BY datetime(updated_at) DESC`);
const searchKB = db.prepare(`
  SELECT a.id, a.title, substr(a.body,1,240) AS excerpt, a.tags
  FROM kb_articles a
  JOIN kb_articles_fts fts ON fts.rowid = a.id
  WHERE kb_articles_fts MATCH ?
  LIMIT 10
`);

/* -------------------- heuristics -------------------- */
function pickCategory(subject = '', body = '') {
  const s = `${subject} ${body}`.toLowerCase();
  if (s.includes('refund') || s.includes('return')) return 'refund';
  if (s.includes('ship') || s.includes('delivery')) return 'shipping';
  if (s.includes('bug') || s.includes('issue') || s.includes('error')) return 'bug';
  return 'other';
}
function pickPriority(subject = '', body = '') {
  const s = `${subject} ${body}`.toLowerCase();
  if (s.includes('urgent') || s.includes('immediately') || s.includes('asap')) return 'high';
  return 'normal';
}
function computeSla() {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  return d.toISOString();
}

/* -------------------- routes -------------------- */
// AI diagnostics
app.get('/api/ai/ping', async (req, res) => {
  if (!openai) return res.status(400).json({ ok: false, reason: 'OPENAI_API_KEY missing or invalid' });
  const r = await callOpenAI('Say OK');
  res.status(r.ok ? 200 : 500).json({ ok: r.ok, text: r.text || null, reason: r.error || null, keyType });
});
app.get('/api/ai/try', async (req, res) => {
  const q = (req.query.q || 'Say hello in one sentence.').toString();
  if (!openai) return res.status(400).json({ ok: false, reason: 'OPENAI_API_KEY missing or invalid' });
  const r = await callOpenAI(q);
  res.status(r.ok ? 200 : 500).json({ ok: r.ok, text: r.text || null, reason: r.error || null });
});

// Tickets
app.get('/api/tickets', (req, res) => {
  res.json(listTickets.all());
});
app.post('/api/tickets', (req, res) => {
  const { subject, body, channel = 'web', requester } = req.body || {};
  const requester_email = requester?.email || '';
  const requester_name  = requester?.name || null;

  if (!subject || !body || !requester_email) {
    return res.status(400).json({ error: 'subject, body, requester.email are required' });
  }

  const priority   = pickPriority(subject, body);
  const category   = pickCategory(subject, body);
  const status     = 'new';
  const sentiment  = null;
  const sla_due_at = computeSla();
  const tags       = JSON.stringify([]);

  const ts = nowISO();
  const info = insTicket.run(
    subject, body, channel, requester_email, requester_name,
    status, priority, category, sentiment, sla_due_at, tags, ts, ts
  );
  const ticketId = info.lastInsertRowid;

  insMsg.run(ticketId, 'requester', body, ts);
  res.status(201).json({ id: ticketId });
});
app.get('/api/tickets/:id', async (req, res) => {
  const id = Number(req.params.id);
  const refreshAi = String(req.query.refreshAi || '').toLowerCase() === '1';

  const t = getTicket.get(id);
  if (!t) return res.status(404).json({ error: 'Not found' });

  t.tags = toArray(t.tags);

  const needsAi = refreshAi || !t.ai_suggestion || !t.ai_suggestion.trim();
  if (needsAi && openai) {
    console.log(`🧠 generating suggestion for ticket #${id} (refresh=${refreshAi})`);
    const suggestion = await buildAiSuggestion(t);
    if (suggestion) {
      try {
        updTicketAi.run(suggestion, nowISO(), id);
        t.ai_suggestion = suggestion;
      } catch (e) {
        console.warn('Could not persist ai_suggestion, returning volatile value.', e?.message || e);
        t.ai_suggestion = suggestion;
      }
    }
  } else if (needsAi && !openai) {
    t.ai_suggestion = '[AI unavailable: OPENAI_API_KEY missing or invalid]';
  }

  res.json(t);
});
app.get('/api/tickets/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  res.json(listMsgs.all(id));
});
app.post('/api/tickets/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  const { body, author_type = 'agent' } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });

  const t = getTicket.get(id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });

  const ts = nowISO();
  insMsg.run(id, author_type, body, ts);
  db.prepare(`UPDATE tickets SET updated_at = ? WHERE id = ?`).run(ts, id);
  res.status(201).json({ ok: true });
});
app.post('/api/tickets/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status required' });

  const t = getTicket.get(id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });

  updTicketStatus.run(status, nowISO(), id);
  res.json({ ok: true });
});
app.post('/api/tickets/:id/tags', (req, res) => {
  const id = Number(req.params.id);
  const { tag } = req.body || {};
  if (!tag) return res.status(400).json({ error: 'tag required' });

  const t = getTicket.get(id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });

  const current = toArray(t.tags);
  const next = uniq([...current, String(tag).trim()]);
  updTicketTags.run(JSON.stringify(next), nowISO(), id);
  res.json({ ok: true, tags: next });
});
app.post('/api/tickets/:id/csat', (req, res) => {
  const id = Number(req.params.id);
  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'rating 1–5 required' });

  const t = getTicket.get(id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });

  insCsat.run(id, r, comment || null, nowISO());
  res.json({ ok: true });
});

// Meta: tags/macros/analytics
app.get('/api/tickets/meta/tags', (req, res) => {
  const rows = db.prepare(`SELECT tags FROM tickets WHERE tags IS NOT NULL AND tags != ''`).all();
  const pool = [];
  for (const r of rows) pool.push(...toArray(r.tags));
  res.json(uniq(pool).sort());
});
app.get('/api/tickets/meta/macros', (req, res) => {
  res.json(MACROS);
});
app.get('/api/tickets/meta/analytics', (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM tickets`).get().c;

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) AS c
    FROM tickets
    GROUP BY status
    ORDER BY c DESC
  `).all();

  const last7 = [];
  const dayFmt = (d) => d.toISOString().slice(0,10);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const start = dayFmt(d) + 'T00:00:00.000Z';
    const end   = dayFmt(d) + 'T23:59:59.999Z';
    const c = db.prepare(`
      SELECT COUNT(*) AS c FROM tickets
      WHERE datetime(created_at) BETWEEN datetime(?) AND datetime(?)
    `).get(start, end).c;
    last7.push({ d: dayFmt(d), c });
  }

  const csatRow = db.prepare(`SELECT AVG(rating) AS avg FROM csat`).get();
  const avgCsat = csatRow?.avg ? Math.round(csatRow.avg * 10) / 10 : null;

  const frts = db.prepare(`
    SELECT t.id AS id, t.created_at AS t_created,
           (SELECT m.created_at FROM messages m
            WHERE m.ticket_id = t.id AND m.author_type='agent'
            ORDER BY datetime(m.created_at) ASC LIMIT 1) AS first_agent
    FROM tickets t
  `).all();
  let sumMin = 0, n = 0;
  for (const r of frts) {
    if (r.first_agent) {
      const a = new Date(r.t_created).getTime();
      const b = new Date(r.first_agent).getTime();
      if (isFinite(a) && isFinite(b) && b >= a) {
        sumMin += (b - a) / 60000; n++;
      }
    }
  }
  const avgFRT = n ? Math.round((sumMin / n) * 10) / 10 : null;

  res.json({ total, byStatus, last7, avgCsat, avgFRT });
});

/* -------------------- Knowledge Base routes -------------------- */
// List articles (simple admin/testing)
app.get('/api/kb/articles', (req, res) => {
  const rows = listKB.all().map(r => ({ ...r, tags: toArray(r.tags) }));
  res.json(rows);
});
// Get one article
app.get('/api/kb/articles/:id', (req, res) => {
  const row = getKB.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.tags = toArray(row.tags);
  res.json(row);
});
// Search with FTS, fallback to LIKE
app.get('/api/kb/search', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json([]);
  const tokens = q.split(/\s+/).map(t => t.replace(/"/g,'')).filter(Boolean);
  const ftsQuery = tokens.map(t => `"${t}"`).join(' ');
  let rows = [];
  try { rows = searchKB.all(ftsQuery); } catch { rows = []; }
  if (rows.length === 0) {
    rows = db.prepare(`
      SELECT id, title, substr(body,1,240) AS excerpt, tags
      FROM kb_articles
      WHERE title LIKE ? OR body LIKE ?
      LIMIT 10
    `).all(`%${q}%`, `%${q}%`);
  }
  res.json(rows.map(r => ({ ...r, tags: toArray(r.tags) })));
});

/* -------------------- start -------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Support platform backend running on http://localhost:${PORT}`);
  console.log(`🔑 OPENAI key type: ${keyType}${keyType==='user' ? '' : ' (expected: user sk-...)'}`);
});
