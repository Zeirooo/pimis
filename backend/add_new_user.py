import asyncio
from backend.database.database import SessionLocal
from backend.database.models import User, UserRole

async def add_user():
    async with SessionLocal() as db:
        new_user = User(
            username="NAMA_YANG_ANDA_INGINKAN", 
            hashed_password="password_aman", 
            role=UserRole.MANAJER_INSTALASI,
            is_active=True
        )
        db.add(new_user)
        await db.commit()
        print("User baru berhasil ditambahkan!")

if __name__ == "__main__":
    asyncio.run(add_user())
