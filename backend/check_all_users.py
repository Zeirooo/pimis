import asyncio
from backend.database.database import SessionLocal
from backend.database.models import User
from sqlalchemy import select

async def get_all_users():
    async with SessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        for u in users:
            # Sesuaikan atribut di bawah ini dengan nama kolom di models.py Anda
            print(f"Username: {u.username}, ID: {u.id}")

if __name__ == "__main__":
    asyncio.run(get_all_users())
