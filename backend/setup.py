import asyncio
from backend.database.database import engine, Base
from backend.database.models import *

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Tabel berhasil dibuat di MySQL!")

if __name__ == "__main__":
    asyncio.run(init())
