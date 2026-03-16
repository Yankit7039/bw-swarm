# Runtime database

Single Postgres database for all templates. The runtime service owns the tables `templates`, `runs`, and `run_events`. Template sandbox pods (e.g. stuck-order-adk) connect to the same DB to write run results and events keyed by `run_id`.

- **Migrations**: Apply SQL files in `migrations/` in order (001_initial.sql, then 002_seed_*.sql).
- **DATABASE_URL**: Use `postgresql+asyncpg://...` for async Python. From Docker: `postgresql+asyncpg://swarm:swarm@postgres:5432/swarm`. From host: `postgresql+asyncpg://swarm:swarm@localhost:5432/swarm`.
- **Admin Console**: Will later add new templates (new rows in `templates`); not in scope for the initial refactor.
