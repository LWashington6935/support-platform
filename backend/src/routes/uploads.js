import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export default function makeUploadsRouter(db) {
  const router = express.Router();

  // storage: /uploads/<timestamp>_<name>
  const uploadDir = path.join(process.cwd(), 'backend', 'public', 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]/g,'_');
      cb(null, `${Date.now()}_${safe}`);
    }
  });
  const upload = multer({ storage });

  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_attachments(
      id INTEGER PRIMARY KEY,
      ticket_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_att_ticket ON ticket_attachments(ticket_id);
  `);
  const ins = db.prepare(`INSERT INTO ticket_attachments(ticket_id,name,url) VALUES (?,?,?)`);
  const list = db.prepare(`SELECT * FROM ticket_attachments WHERE ticket_id=? ORDER BY id DESC`);

  // POST /api/uploads/:ticketId  (form-data: file)
  router.post('/:ticketId', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file missing' });
    const ticketId = Number(req.params.ticketId);
    const url = `/uploads/${req.file.filename}`;
    ins.run(ticketId, req.file.originalname, url);
    res.status(201).json({ name: req.file.originalname, url });
  });

  // GET /api/uploads/:ticketId
  router.get('/:ticketId', (req, res) => {
    res.json(list.all(Number(req.params.ticketId)));
  });

  return router;
}
