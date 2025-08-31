import express from 'express';

export default function makePresenceRouter() {
  const router = express.Router();

  // ticketId -> Map(agentId -> timestamp)
  const viewers = new Map();

  // JOIN/HEARTBEAT: POST /api/presence/:ticketId  { agentId }
  router.post('/:ticketId', (req, res) => {
    const tid = String(req.params.ticketId);
    const agentId = String((req.body?.agentId) || 'agent');
    const now = Date.now();
    if (!viewers.has(tid)) viewers.set(tid, new Map());
    viewers.get(tid).set(agentId, now);
    res.json({ ok: true });
  });

  // LEAVE: DELETE /api/presence/:ticketId  { agentId }
  router.delete('/:ticketId', (req, res) => {
    const tid = String(req.params.ticketId);
    const agentId = String((req.body?.agentId) || 'agent');
    viewers.get(tid)?.delete(agentId);
    res.json({ ok: true });
  });

  // LIST: GET /api/presence/:ticketId
  router.get('/:ticketId', (req, res) => {
    const tid = String(req.params.ticketId);
    const m = viewers.get(tid) || new Map();
    // prune > 30s
    const fresh = [];
    const now = Date.now();
    for (const [k, ts] of m.entries()) {
      if (now - ts < 30000) fresh.push(k);
      else m.delete(k);
    }
    res.json({ viewers: fresh });
  });

  return router;
}
