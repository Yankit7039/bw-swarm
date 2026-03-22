"""Run SQL and Python migrations from runtime/db/migrations/ in order."""
import importlib.util
import re
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection
from runtime.db.db import engine


MIGRATION_PATTERN = re.compile(r"^\d{3}_")


async def _run_sql_migration(conn: AsyncConnection, path: Path) -> None:
    """Execute a single SQL migration file."""
    sql = path.read_text(encoding="utf-8")
    # Strip comment lines before splitting on ; to avoid
    # inline semicolons inside comments breaking statement parsing.
    lines = [l for l in sql.splitlines() if not l.strip().startswith("--")]
    clean_sql = "\n".join(lines)
    for stmt in clean_sql.split(";"):
        stmt = stmt.strip()
        if stmt:
            await conn.execute(text(stmt))


async def _run_python_migration(conn: AsyncConnection, path: Path) -> None:
    """Execute a single Python migration file."""
    module_name = f"migration_{path.stem}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load migration: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    run_func = getattr(module, "run", None)
    if run_func is None:
        raise AttributeError(f"Migration {path} must define an async 'run(conn)' function")
    if not callable(run_func):
        raise TypeError(f"Migration {path} 'run' must be callable")

    await run_func(conn)


async def run_migrations() -> None:
    """Execute each .sql and .py migration file in migrations/ in lexicographic order."""
    migrations_dir = Path(__file__).resolve().parent / "migrations"
    if not migrations_dir.is_dir():
        return

    # Gather .sql and .py files that match the naming convention (NNN_*)
    sql_files = [p for p in migrations_dir.glob("*.sql") if MIGRATION_PATTERN.match(p.name)]
    py_files = [p for p in migrations_dir.glob("*.py") if MIGRATION_PATTERN.match(p.name)]

    all_files = sorted(sql_files + py_files, key=lambda p: p.name)

    async with engine.begin() as conn:
        for path in all_files:
            if path.suffix == ".sql":
                await _run_sql_migration(conn, path)
            elif path.suffix == ".py":
                await _run_python_migration(conn, path)
