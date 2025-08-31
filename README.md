# Customer Support Platform 

A thin-slice MVP you can run locally in minutes:

- **Backend:** Node + Express + SQLite (better-sqlite3), Zod input validation
- **Agent UI:** Minimal inbox/ticket view (served at `/`) using Tailwind CDN + vanilla JS
- **LLM Triage (stub):** Simple category detection you can swap for real tools later
- **Playwright test:** Example happy-path API test

## Quick Start

```bash
# 1) Install deps
cd backend
npm install

# 2) Start the server
npm run dev     # nodemon watch
# or
npm start

# The app serves the Agent UI at http://localhost:4000
```

> The database is a local file at `./data/support.db` created automatically on first run.

## API Endpoints

- `POST /api/tickets` → create ticket
- `GET /api/tickets` → list tickets
- `GET /api/tickets/:id` → ticket details
- `GET /api/tickets/:id/messages` → list messages
- `POST /api/tickets/:id/messages` → add message (agent or customer)

## Run Playwright Test

```bash
# in project root
npm i -D @playwright/test
npx playwright install
npx playwright test
```

## Swap-in Real Triage

Replace `backend/src/services/triage.js` with calls to your model provider using
a strict schema (tool pattern). Persist outputs onto the ticket/message rows.

## Folder Structure

```
support-platform-starter/
├─ backend/
│  ├─ package.json
│  ├─ src/
│  │  ├─ server.js
│  │  ├─ routes/
│  │  │  └─ tickets.js
│  │  └─ services/
│  │     └─ triage.js
│  └─ public/
│     └─ index.html
├─ tests/
│  └─ tickets.spec.ts
└─ README.md
```

Have fun—and extend as you like (auth, roles, macros, SLA policies, Shopify/Stripe integrations, etc.).
