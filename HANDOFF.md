# Rental Dashboard — Handoff

## Links en vivo

- **Demo**: https://rental-dashboard-navy.vercel.app/login → botón "Ver demo en vivo" (sin registrarse)
- **Backend API**: https://rental-dashboard-mvjm.onrender.com (health check: `/health`)
- **Repo**: https://github.com/sebpost2/rental-dashboard

## Credenciales demo

- Email: `demo@rentalledger.com`
- Password: `demopass123`
- Cuenta sembrada con 2 propiedades y 5 meses de ingresos/gastos (ver "Re-sembrar datos demo" si se borran).

## Stack

- **Backend**: FastAPI + SQLAlchemy + Alembic + PostgreSQL, auth JWT vía cookie `httpOnly`, rate limiting (slowapi), desplegado en Render (Docker, plan free).
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui (variante "base", no Radix), desplegado en Vercel.
- **Identidad visual**: "Blueprint Ledger" — ink-blue/blueprint-blue/brass/brick/paper, tipografía Space Grotesk (títulos) + Inter (UI) + IBM Plex Mono (todos los montos/fechas, tabular).

## Estructura del repo

```
rental-dashboard/
  backend/           FastAPI, tests en backend/tests/ (41 tests, TDD)
  frontend/          Next.js, App Router en frontend/src/app/
  render.yaml        Blueprint de infraestructura para Render
  docker-compose.yml Desarrollo local (Postgres + backend)
```

## Correr local

```bash
docker compose up -d db          # Postgres en localhost:5432
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
# crear backend/.env con JWT_SECRET=<random>, ver .env.example
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload

cd frontend
npm install
# crear frontend/.env.local con NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Tests backend: `cd backend && .venv/Scripts/python -m pytest`

## Deploy — cómo redesplegar

### Backend (Render)
Conectado a GitHub (`sebpost2/rental-dashboard`, root `backend/`). Push a `main` → redeploy automático. Variables de entorno en Render → servicio → Environment:
- `DATABASE_URL` (Postgres interno de Render)
- `JWT_SECRET` (generado, no lo cambies o se invalidan las sesiones activas)
- `ENVIRONMENT=production`
- `CORS_ORIGINS=https://rental-dashboard-navy.vercel.app` (agregar más orígenes separados por coma si hay otro dominio)

### Frontend (Vercel)
**No está conectado a GitHub** — se desplegó directo desde archivos vía MCP de Vercel (sin repo Git vinculado). Esto significa que un push a GitHub **no** redespliega el frontend automáticamente. Para actualizarlo:
- Opción rápida: pedirle a Claude que redespliegue con la herramienta MCP de Vercel (`deploy_to_vercel`).
- Opción permanente (recomendada si vas a iterar seguido): conectar el proyecto de Vercel al repo de GitHub desde el dashboard de Vercel (Project → Settings → Git), así cada push a `main` dispara un deploy solo.

`frontend/.env.production` tiene `NEXT_PUBLIC_API_URL` apuntando al backend — está en `.gitignore` (no se subió), así que si reconectás Git en Vercel vas a necesitar setear esa variable en el dashboard de Vercel en su lugar (Project → Settings → Environment Variables).

## Re-sembrar datos demo

Si se borra la cuenta demo o los datos, correr contra el backend en producción:

```bash
BASE=https://rental-dashboard-mvjm.onrender.com
curl -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"demo@rentalledger.com","password":"demopass123"}'
# luego crear propiedades + ingresos/gastos vía POST /properties, /properties/{id}/incomes, /properties/{id}/expenses
```

## Fases completadas (todas)

1. Scaffolding (FastAPI + Next.js + Docker)
2. Auth (JWT en cookie httpOnly, rate limiting, password mínimo 8 caracteres)
3. Propiedades (CRUD aislado por usuario)
4. Ingresos y gastos (CRUD anidado, filtro por fecha)
5. Reportes y dashboard (resumen, gráfica mensual, export CSV, diseño "Blueprint Ledger")
6. Deploy (Render + Vercel, en vivo) + botón de demo sin registro

## Pendientes conocidos (no bloqueantes)

- **Cold start**: el backend en el plan free de Render se duerme tras inactividad — el primer request tras un rato puede tardar ~30s.
- **Vercel sin Git conectado**: ver sección de deploy arriba — considerar conectar el repo si vas a seguir iterando.
- **Multi-moneda / roles de equipo**: fuera de alcance del MVP, mencionado en la idea original pero no implementado.

## Revisiones de seguridad ya aplicadas

- JWT_SECRET obligatorio (sin default inseguro)
- Rate limiting en login/register (10/min por IP)
- Password mínimo 8 caracteres validado en backend
- Token en cookie `httpOnly` (no localStorage, protegido contra robo vía XSS; se eliminó `frontend/src/lib/auth.ts`, que guardaba una copia redundante en localStorage)
- CORS restringido a orígenes explícitos vía env var
- Validación de longitud/rango en los schemas de propiedades, ingresos y gastos (montos no negativos, strings acotados)
- Guard de Origin en `/auth/login` y `/auth/logout` contra CSRF (únicos endpoints "simple request" que el preflight de CORS no cubre)
