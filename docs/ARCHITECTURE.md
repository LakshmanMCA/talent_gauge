# Architecture

## Layout
```
backend/  config common accounts schools academics public_exams school_exams notifications reporting platform_admin
frontend/ app (routes) components lib
```
Domain apps never import each other's internals except through `services.py` and `common/`.

## Separation of the two domains
| Concern | Public | School |
|---|---|---|
| Identity | `User.role=public_user`, `school=NULL` | `school_admin/teacher/student`, `school` required |
| Enforcement | DB `CheckConstraint user_school_matches_role` | same |
| Content | `public_exams.*` (global) | `school_exams.*` (every row has `school_id`) |
| Cache keys | `public:*` | `school:{id}:*` |
| Login | `portal=public` | `portal=school` / `platform` — role must match portal |

## Tenant isolation (defence in depth)
1. `school_id` comes only from the verified token user, never from request input (`TenantScopedMixin`).
2. Cross-tenant ids return **404**, not 403, so existence is not leaked.
3. Serializers reject related objects from another school (`_check_same_school`).
4. Student exam eligibility is computed from their *current enrolment*, so unassigned exams look nonexistent.
5. Cache keys embed the school id; tests cover cross-school reads, publish and export.

## Exam integrity
- Server owns time: `expires_at` is set at start; every answer/submit re-checks it. Refresh resumes the same attempt.
- Attempt **snapshot** frozen at start: later question edits never alter history. Answer key is never sent to the browser; review opens only after close.
- Start is idempotent and race-safe: partial unique index allows one in-progress attempt per user+exam; losers of a race receive the winner.
- Submit is atomic + idempotent (`SELECT … FOR UPDATE`, status check) → double-click/retry yields one result.
- Retakes need an audited `RetakeAuthorization` (admin, reason) consumed in the same transaction as the new attempt.
- Celery beat `auto_submit_expired` finalises abandoned attempts every minute (idempotent).

## Data structures & complexity
| Need | Choice | Cost |
|---|---|---|
| Scoring | single pass, dict of answers | O(Q) time, O(Q) space |
| Random question draw | ids-only query + reservoir sampling (no `ORDER BY RANDOM()`) | O(N) time, O(k) memory |
| Snapshot lookup / palette stats | dict / one-pass reducers | O(1) / O(Q) |
| Lists | keyset (`CursorPagination`) available for huge tables; page-number with `page_size ≤ 100` elsewhere | bounded |
| Counters (admission/employee no.) | row lock + atomic increment | no duplicates under concurrency |
| Stats | DB `GROUP BY` aggregates, never Python loops over rows | 1 query |
| CSV export | streaming iterator, chunk 500 | O(chunk) memory |

Indexes follow query shapes: `(school, status, start_at)`, `(user, is_read, -created_at)`, `(status, expires_at)` for the sweeper, `(test, -percentage, time)` for rankings.

## Caching
Redis is an accelerator, never the source of truth (`IGNORE_EXCEPTIONS`, DB fallback). Read-through with TTL jitter (stampede guard), invalidation `on_commit` only. Cached: categories, home stats, leaderboard, school dashboard, unread counts.

## Notification system
In-app + email, preference-aware, **idempotent** (`UNIQUE(user, idempotency_key)`), bulk fan-out via one `bulk_create(ignore_conflicts)` per batch, email sent by Celery with exponential backoff and an `emailed` flag so retries never double-send. Triggers: welcome, result ready, exam published (class fan-out), reminder (beat, 1h before start), retake approved, school approved. Unread badge is cached 120 s and invalidated on change.

## Security checklist
Argon2 hashing · JWT 30 min + rotating refresh · same error for all login failures · per-scope throttles (auth, start, answer) · no secrets in code (fails to boot in prod without `DJANGO_SECRET_KEY`) · HSTS/secure cookies/SSL redirect when `DEBUG=0` · CORS allow-list · `statement_timeout` on Postgres · CSV-injection guard · audit log for approvals, publishing, retakes, exports · non-root containers · security headers on the web app.

## Known gaps (deliberately not faked)
- **No migration files shipped** (generated on first run; commit them).
- **Not executed here:** the build environment had no network, so Django/Next could not be installed. Backend was syntax-compiled and the pure-algorithm tests pass (8/8); the Django integration tests and the frontend build have **not** been run yet — expect small fixes on first run.
- No UI yet for academic years/classes/subjects/teacher assignments or for **creating exams** (use `/api/docs/` or Django admin); public-content management UI (categories/questions/tests) is API-only under `/api/v1/public/admin/`.
- Tokens are stored in `localStorage` for simplicity; for production move to httpOnly cookies + CSRF.
- Subscriptions/premium, SMS/push, proctoring, bulk CSV import and PDF reports are specified in the brief but not built (premium tests return 403 via an entitlement hook in `start_attempt`).
- Scheduling beyond reminders (e.g. email digests) would be a new beat task.
