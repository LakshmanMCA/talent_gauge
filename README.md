# Talent Gauge

Two isolated products on one platform: **Public Exams** (learners, mock tests) and **School Exams** (multi-tenant, school-run assessments), plus a Super Admin console.
Django REST + PostgreSQL + Redis + Celery backend; Next.js 14 + Tailwind frontend.

## Run with Docker (recommended)
```bash
cp backend/.env.example backend/.env
docker compose up --build
docker compose exec backend python manage.py seed_demo
```
Web: http://localhost:3000 · API docs: http://localhost:8000/api/docs/ · Health: http://localhost:8000/health/

> **First run generates migrations** (`entrypoint.sh` runs `makemigrations`). Commit the generated
> `backend/*/migrations/` folders so every environment applies identical schema history.

## Run without Docker
```bash
cd backend && python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations && python manage.py migrate && python manage.py seed_demo
python manage.py runserver            # uses SQLite + in-memory cache + eager Celery when no env vars are set
cd ../frontend && cp .env.example .env.local && npm install && npm run dev
```

## Demo logins (after `seed_demo`)
| Portal | Email | Password |
|---|---|---|
| Platform admin | admin@talentgauge.test | Admin@12345 |
| Learner | learner@talentgauge.test | Learner@123 |
| School admin | principal@greenfield.test | School@1234 |
| Teacher | teacher@greenfield.test | Teacher@123 |
| Student | student@greenfield.test | Student@123 |

**Change or delete these before any real deployment.**

## Tests
```bash
cd backend
python -m unittest tests.test_algorithms      # pure logic, no DB
pytest                                        # integration: tenant isolation, attempts, retakes, notifications
```

See `docs/ARCHITECTURE.md` for design, security model, data-structure choices and the gap list.
