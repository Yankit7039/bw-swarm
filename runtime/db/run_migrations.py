"""Run SQL migrations from runtime/db/migrations/ in order."""
from pathlib import Path
from sqlalchemy import text
from runtime.db.db import engine


async def run_migrations() -> None:
    """Execute each .sql file in migrations/ in lexicographic order."""
    migrations_dir = Path(__file__).resolve().parent / "migrations"
    if not migrations_dir.is_dir():
        return
    files = sorted(migrations_dir.glob("*.sql"))
    async with engine.begin() as conn:
        for path in files:
            sql = path.read_text(encoding="utf-8")
            # Strip comment lines before splitting on ; to avoid
            # inline semicolons inside comments breaking statement parsing.
            lines = [l for l in sql.splitlines() if not l.strip().startswith("--")]
            clean_sql = "\n".join(lines)
            for stmt in clean_sql.split(";"):
                stmt = stmt.strip()
                if stmt:
                    await conn.execute(text(stmt))