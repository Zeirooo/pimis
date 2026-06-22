import asyncio
from backend.database.database import SessionLocal
from backend.database.models import User
from sqlalchemy import select

async def cleanup():
    async with SessionLocal() as db:
        # Menghapus user selain admin_test
        await db.execute(
            await db.execute(select(User).where(User.username != "admin_test"))
        )
        # Atau cara manual:
        result = await db.execute(select(User).where(User.username != "admin_test"))
        users_to_delete = result.scalars().all()
        for u in users_to_delete:
            await db.delete(u)
        await db.commit()
        print("Akun tambahan berhasil dibersihkan, sistem kembali ke admin_test.")

if __name__ == "__main__":
    asyncio.run(cleanup())
