# Rental Dashboard (FastAPI edition)

A rental ledger for landlords with a few properties: income and expenses per
property, and a monthly report that closes the books. FastAPI backend,
Next.js frontend.

**Live demo:** [rental-dashboard-navy.vercel.app](https://rental-dashboard-navy.vercel.app/login)
("Ver demo en vivo", no sign-up). The free Render backend sleeps, so the
first request can take up to a minute.

This is the original version. The same API was later rebuilt in Spring
Boot 4, and the frontend runs against it unchanged:
[rental-dashboard-spring](https://github.com/sebpost2/rental-dashboard-spring).

## Stack

- **Backend** (`backend/`): FastAPI, SQLAlchemy, Alembic, PostgreSQL. JWT
  auth in an httpOnly cookie, rate-limited login (slowapi). 41 pytest tests,
  written test-first.
- **Frontend** (`frontend/`): Next.js (App Router), TypeScript, Tailwind,
  shadcn/ui.
- **Deploy**: backend on Render (Docker, `render.yaml`), database on Neon,
  frontend on Vercel.

## Running it

```bash
docker compose up -d          # Postgres + backend on :8000
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm install && npm run dev    # http://localhost:3000
```

## Tests

The tests use an in-memory SQLite database, so they need no Postgres:

```bash
cd backend
pip install -r requirements.txt
JWT_SECRET=test pytest
```
