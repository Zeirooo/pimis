from __future__ import annotations

from collections.abc import AsyncGenerator
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DEFAULT_SQLITE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "pimis.db"))

# Priority: explicit DATABASE_URL env var -> MYSQL_DATABASE_URL -> local sqlite file for dev
DATABASE_URL: str = os.getenv("DATABASE_URL") or os.getenv("MYSQL_DATABASE_URL") or (
    f"sqlite+aiosqlite:///{DEFAULT_SQLITE_PATH}"
)
SQL_ECHO: bool = os.getenv("SQL_ECHO", "false").strip().lower() in {"1", "true", "yes", "on"}


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""


engine_kwargs: dict[str, object] = {
    "echo": SQL_ECHO,
    "future": True,
}

if DATABASE_URL.startswith("mysql"):
    engine_kwargs["pool_recycle"] = 3600
elif DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session and close it afterward."""
    async with SessionLocal() as session:
        yield session

