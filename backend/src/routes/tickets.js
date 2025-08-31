import express from 'express';
import { z } from 'zod';

export default function makeTicketRouter(db, triage) {
  const router = express.Router();

  // ---- Validators ----
  const requesterSchema = z.object({
    email: z.string().email(),
    name: z.string().nullish()
  });
  const createTicketSchema = z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    channel: z.string().default('web'),
    requester: requesterSchema
  });

  // ---- Queries ----
  const qInsertTicket = db.prepare(`
    INSERT INTO tickets (subject, channel, category, status, priority, sentiment,
                         requester_email, requester_name, ai_suggestion)
    VALUES (@subject, @channel, @category, 'new', 'normal', @sentiment,
            @requester_email, @requester_name, @ai_suggestion)
  `);
  const qInsertMessage = db.prepare(`INSERT INTO messages (ticket_id, author_type, body) VALUES (?, ?, ?)`);
  const qGetTicket = db.prepare(`SELECT * FROM tickets WHERE id = ?`);
  const qListTickets = db.prepare(`SELECT * FROM tickets ORDER BY updated_at DESC`);
  const qListMessages = db.prepare(`SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC`);
  const qAddTag = db.prepare(`INSERT OR IGNORE INTO ticket_tags (ticket_id, tag) VALUES (?, ?)`);
  const qListTags = db.prepare(`SELECT DISTINCT name FROM tags ORDER BY name ASC`);
  const qListMacros = db.prepare(`SELECT id, name, body FROM macros ORDER BY id ASC`);
  const qUpdateStatus = db.prepare(`UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`);
  const qInsertCsat = db.prepare(`INSERT INTO csat (ticket_id, rating, comment) VALUES (?, ?, ?)`);

  // ---- Agent API ----
  router.get('/', (_req, res) => res.json(qListTickets.all()));

  router.get('/:id', (req, res) => {
    const t = qGetTicket.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const tags = db.prepare(`SELECT tag FROM ticket_tags WHERE ticket_id = ?`).all(t.id).map(r => r.tag);
    res.json({ ...t, tags });
  });

  router.get('/:id/messages', (req, res) => res.json(qListMessages.all(req.params.id)));

  router.post('/', async (req, res) => {
    try {
      const input = createTicketSchema.parse(req.body);
      const ai = await triage({ subject: input.subject, body: input.body });
      const result = qInsertTicket.run({
        subject: input.subject,
        channel: input.channel || 'web',
        category: ai.category,
        sentiment: ai.sentiment,
        requester_email: input.requester.email,
        requester_name: input.requester.name ?? null,
        ai_suggestion: ai.ai_suggestion
      });
      const ticketId = result.lastInsertRowid;
      qInsertMessage.run(ticketId, 'customer', input.body);
      res.status(201).json(qGetTicket.get(ticketId));
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/:id/messages', (req, res) => {
    const schema = z.object({ author_type: z.enum(['customer','agent']), body: z.string().min(1) });
    const input = schema.parse(req.body);
    const t = qGetTicket.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    qInsertMessage.run(t.id, input.author_type, input.body);
    db.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).run(t.id);
    res.status(201).json({ ok: true });
  });

  router.post('/:id/tags', (req, res) => {
    const input = z.object({ tag: z.string().min(1) }).parse(req.body);
    const t = qGetTicket.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    qAddTag.run(t.id, input.tag);
    db.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).run(t.id);
    res.json({ ok: true });
  });

  router.post('/:id/status', (req, res) => {
    const input = z.object({ status: z.enum(['new','open','pending','solved']) }).parse(req.body);
    const t = qGetTicket.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    qUpdateStatus.run(input.status, t.id);
    res.json({ ok: true });
  });

  router.post('/:id/csat', (req, res) => {
    const input = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().nullish() }).parse(req.body);
    const t = qGetTicket.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    qInsertCsat.run(t.id, input.rating, input.comment ?? null);
    res.json({ ok: true });
  });

  // ---- Meta ----
  router.get('/meta/tags', (_req, res) => res.json(qListTags.all().map(r => r.name)));
  router.get('/meta/macros', (_req, res) => res.json(qListMacros.all()));
  router.get('/meta/analytics', (_req, res) => {
    const total = db.prepare(`SELECT COUNT(*) c FROM tickets`).get().c;
    const byStatus = db.prepare(`SELECT status, COUNT(*) c FROM tickets GROUP BY status ORDER BY status`).all();
    const last7 = db.prepare(`
      SELECT strftime('%Y-%m-%d', created_at) d, COUNT(*) c
      FROM tickets
      WHERE created_at >= date('now', '-6 days')
      GROUP BY d ORDER BY d
    `).all();
    const avgCsat = db.prepare(`SELECT ROUND(AVG(rating),2) a FROM csat`).get().a;
    const avgFRT = db.prepare(`
      SELECT ROUND(AVG(
        CAST((julianday(m.created_at) - julianday(t.created_at)) * 24 * 60 AS INTEGER)
      ), 2) a
      FROM tickets t
      JOIN messages m ON m.ticket_id = t.id AND m.author_type = 'agent'
      GROUP BY t.id
      LIMIT 1
    `).get()?.a ?? null;
    res.json({ total, byStatus, last7, avgCsat, avgFRT });
  });

  // ---- Test AI helper ----
  router.post('/test-ai', async (req, res) => {
    const schema = z.object({ subject: z.string().min(1), body: z.string().min(1) });
    const input = schema.parse(req.body);
    const result = await triage(input);
    res.json(result);
  });

  // =========================
  // ===== Public (Portal) ===
  // =========================

  // List tickets by requester email (no auth; demo only)
  router.get('/public', (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    const rows = db.prepare(`SELECT * FROM tickets WHERE lower(requester_email)=? ORDER BY updated_at DESC`).all(email);
    res.json(rows);
  });

  // Get a specific ticket + messages, only if it belongs to the email
  router.get('/public/:id', (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    const t = qGetTicket.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (String(t.requester_email || '').toLowerCase() !== email) return res.status(403).json({ error: 'Forbidden' });
    const messages = qListMessages.all(t.id);
    res.json({ ticket: t, messages });
  });

  // Post a customer reply to a ticket they own
  router.post('/public/:id/messages', (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    const input = z.object({ body: z.string().min(1) }).parse(req.body);
    const t = qGetTicket.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (String(t.requester_email || '').toLowerCase() !== email) return res.status(403).json({ error: 'Forbidden' });

    qInsertMessage.run(t.id, 'customer', input.body);
    db.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).run(t.id);
    res.status(201).json({ ok: true });
  });

  return router;
}
// routes/tickets.js
import express from 'express';
import { logAudit } from './audit.js'; // if audit.js exports it; otherwise remove this line

export default function makeTicketsRouter(db) {
  const router = express.Router();

  // ... your other routes (list, get, messages) stay as they are

  // ==== CREATE TICKET (enhanced) ====
  router.post('/', (req, res) => {
    const { subject, body, channel = 'web', requester = {}, priority } = req.body || {};
    const requester_email = String(requester.email || '').trim();
    const requester_name  = requester.name ? String(requester.name).trim() : null;

    if (!subject || !body || !requester_email) {
      return res.status(400).json({ error: 'subject, body, requester.email are required' });
    }

    // --- SLA: 24h normally, 12h for high ---
    const slaHours = (priority === 'high') ? 12 : 24;
    const sla_due_at = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

    // --- Category (keyword stub; swap with OpenAI later) ---
    const text = (subject + ' ' + body).toLowerCase();
    let category = 'other';
    if (text.includes('refund')) category = 'refund';
    else if (text.includes('ship') || text.includes('delivery')) category = 'shipping';
    else if (text.includes('bug') || text.includes('error')) category = 'bug';

    // --- Sentiment (stub) ---
    let sentiment = 'neutral';
    if (/\b(angry|upset|terrible|awful|ridiculous|furious|annoyed)\b/.test(text)) sentiment = 'negative';
    if (/\b(great|awesome|thanks|love|perfect|amazing)\b/.test(text))             sentiment = 'positive';

    // --- Insert ticket + initial customer message ---
    const info = db.prepare(`
      INSERT INTO tickets(
        subject, body, requester_email, requester_name,
        channel, priority, category, sentiment, tags, sla_due_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      subject, body, requester_email, requester_name,
      channel, priority || 'normal', category, sentiment, '[]', sla_due_at
    );

    const id = info.lastInsertRowid;

    db.prepare(`INSERT INTO messages(ticket_id, author_type, body) VALUES (?,?,?)`)
      .run(id, 'customer', body);

    // Optional audit log (remove if you didn’t wire audit.js)
    try {
      logAudit(db, {
        ticket_id: id,
        actor_type: 'customer',
        actor: requester_email,
        action: 'create',
        payload: { subject, channel, category, priority: priority || 'normal' }
      });
    } catch {}

    res.status(201).json({ id });
  });

  return router;
}
