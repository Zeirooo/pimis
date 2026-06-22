import asyncio
from backend.database.database import SessionLocal
from backend.database.models import User
from sqlalchemy import select

async def list_users():
    async with SessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        print([u.username for u in users])

if __name__ == "__main__":
    asyncio.run(list_users())
