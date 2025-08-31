import express from 'express';

export default function makeAuditRouter(db) {
  const router = express.Router();

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log(
      id INTEGER PRIMARY KEY,
      ticket_id INTEGER,
      actor_type TEXT,   -- 'agent' | 'system' | 'customer'
      actor TEXT,        -- email or name
      action TEXT NOT NULL, -- 'create'|'status'|'reply'|'tag'|'macro'|'upload'|'csat'|...
      payload TEXT,      -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ticket ON audit_log(ticket_id);
  `);
  const list = db.prepare(`SELECT * FROM audit_log WHERE ticket_id=? ORDER BY id DESC`);
  router.get('/:ticketId', (req, res) => res.json(list.all(Number(req.params.ticketId))));
  return router;
}

// Helper you can import to log events:
export function logAudit(db, { ticket_id, actor_type, actor, action, payload }) {
  const stmt = db.prepare(`INSERT INTO audit_log(ticket_id,actor_type,actor,action,payload) VALUES (?,?,?,?,json(?))`);
  stmt.run(ticket_id ?? null, actor_type ?? 'system', actor ?? '', action, payload ? JSON.stringify(payload): null);
}
