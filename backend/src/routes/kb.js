import express from 'express';
import { z } from 'zod';

export default function makeKbRouter(db) {
  const router = express.Router();

  // Tables (simple KB; add FTS if you like)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_articles(
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_kb_category ON kb_articles(category);
  `);

  const insert = db.prepare(`INSERT INTO kb_articles(title,body,category) VALUES (?,?,?)`);
  const searchQ = db.prepare(`
    SELECT id,title,substr(body,1,300) AS snippet,category
    FROM kb_articles
    WHERE title LIKE ? OR body LIKE ?
    ORDER BY created_at DESC LIMIT 10
  `);
  const getQ = db.prepare(`SELECT * FROM kb_articles WHERE id=?`);

  // Search: /api/kb/search?q=shipping
  router.get('/search', (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const like = `%${q}%`;
    res.json(searchQ.all(like, like));
  });

  // Get one
  router.get('/:id', (req, res) => {
    const row = getQ.get(Number(req.params.id));
    if (!row) return res.sendStatus(404);
    res.json(row);
  });

  // (Demo) Admin add article
  router.post('/', (req, res) => {
    const { title, body, category } = z.object({
      title: z.string().min(3),
      body: z.string().min(20),
      category: z.string().optional()
    }).parse(req.body);
    const info = insert.run(title, body, (category||'general'));
    res.status(201).json({ id: info.lastInsertRowid });
  });

  return router;
}
