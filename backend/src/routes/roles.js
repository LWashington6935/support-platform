import express from 'express';

export default function makeRolesRouter() {
  const router = express.Router();

  // Set role (demo): POST /api/roles/set { role: 'agent'|'manager'|'admin' }
  router.post('/set', (req, res) => {
    const role = String(req.body?.role || 'agent');
    res.cookie('role', role, { httpOnly: false, sameSite: 'lax' });
    res.json({ ok: true, role });
  });

  // GET current role
  router.get('/me', (req, res) => {
    res.json({ role: req.cookies?.role || 'agent' });
  });

  return router;
}
