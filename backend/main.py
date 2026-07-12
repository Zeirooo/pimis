from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date, timedelta
import os

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.database import Base, SessionLocal, engine, get_db
from backend.database import models  # noqa: F401
from backend.database.models import (
    DemandPrediction,
    InventoryTransaction,
    Medicine,
    POStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    TransactionType,
    User,
    UserRole,
)
from backend.ml.registry import ModelRegistry
from backend.ml.trainer import MODELS_DIR, train_batch
from backend.routers.predictions import router as predictions_router
from backend.routers.restocking import router as restocking_router
from backend.routers.transactions import router as transactions_router
from backend.schemas.schemas import MedicineCreate, MedicineResponse, MedicineUpdate
from backend.schemas.schemas import SupplierResponse, SupplierUpdate

logger = logging.getLogger(__name__)


def _parse_origins(env_value: str | None) -> list[str]:
    if not env_value:
        return [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:8080",
            "http://localhost:8081",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:8081",
        ]

    # Comma-separated list of allowed origins
    origins = [origin.strip() for origin in env_value.split(",") if origin.strip()]
    return origins or ["http://localhost:3000"]


async def _train_untrained_medicines(registry: ModelRegistry) -> None:
    """Best-effort background training for medicines that have no model loaded yet."""

    async with SessionLocal() as db:
        result = await db.execute(select(Medicine.id))
        medicine_ids = result.scalars().all()

    await train_batch(SessionLocal, medicine_ids, registry, MODELS_DIR, skip_if_fully_loaded=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize database schema and the ML model registry before serving requests."""

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        has_status_column = await conn.run_sync(
            lambda sync_conn: any(
                column["name"] == "status"
                for column in inspect(sync_conn).get_columns("suppliers")
            ),
        )
        if not has_status_column:
            await conn.execute(
                text("ALTER TABLE suppliers ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'"),
            )

    async with SessionLocal() as db:
        await _seed_demo_data(db)

    os.makedirs(MODELS_DIR, exist_ok=True)

    registry = ModelRegistry()
    await registry.load_all(MODELS_DIR)
    app.state.model_registry = registry

    startup_training_task = asyncio.create_task(_train_untrained_medicines(registry))

    yield

    startup_training_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await startup_training_task
    await engine.dispose()


app = FastAPI(title="PIMIS", version="0.1.0", lifespan=lifespan)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Basic health check for the frontend and local debugging."""

    return {"status": "ok", "service": "pimis-api"}


async def _resolve_supplier_id(db: AsyncSession, supplier_id: int | None) -> int:
    """Return a valid existing supplier id."""

    if supplier_id is not None:
        supplier = await db.get(Supplier, supplier_id)
        if supplier is not None:
            return supplier.id

    raise HTTPException(status_code=404, detail="Supplier not found.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(os.getenv("CORS_ALLOW_ORIGINS")),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _seed_demo_data(db: AsyncSession) -> dict[str, str]:
    """Seed a minimal dataset for local transaction API testing."""

    demo_suppliers = [
        Supplier(
            name="PT Kimia Farma",
            contact_person="Budi Santoso",
            email="b2b.orders@kimiafarma.co.id",
            phone="+628123456789",
            status="Active",
        ),
        Supplier(
            name="PT Sanbe Farma",
            contact_person="Rina Wijaya",
            email="hospital.channel@sanbe.co.id",
            phone="+628112223334",
            status="Active",
        ),
        Supplier(
            name="PT Kalbe Farma",
            contact_person="Andre Kusuma",
            email="institutional.sales@kalbe.co.id",
            phone="+628133445566",
            status="Active",
        ),
        Supplier(
            name="PT Dexa Medica",
            contact_person="Melati Anggraini",
            email="pharma.logistics@dexa-medica.com",
            phone="+628155667788",
            status="Active",
        ),
        Supplier(
            name="PT Pharos Indonesia",
            contact_person="Hendra Gunawan",
            email="procurement@pharos.co.id",
            phone="+6282112345678",
            status="Inactive",
        ),
    ]

    for supplier in demo_suppliers:
        existing_supplier_result = await db.execute(select(Supplier).where(Supplier.name == supplier.name))
        existing_supplier = existing_supplier_result.scalar_one_or_none()
        if existing_supplier is None:
            db.add(supplier)
        else:
            existing_supplier.contact_person = supplier.contact_person
            existing_supplier.email = supplier.email
            existing_supplier.phone = supplier.phone
            if not existing_supplier.status:
                existing_supplier.status = supplier.status

    await db.flush()

    existing_medicine = await db.execute(select(Medicine.id).limit(1))
    if existing_medicine.scalar_one_or_none() is not None:
        await db.commit()
        return {"message": "Already seeded"}

    user = User(
        username="admin_test",
        hashed_password="temporary_seed_password",
        role=UserRole.MANAJER_INSTALASI,
        is_active=True,
    )

    supplier_lookup = {supplier.name: supplier for supplier in demo_suppliers}
    supplier = supplier_lookup["PT Kimia Farma"]

    db.add_all([user, supplier])
    await db.flush()

    medicines = [
        Medicine(
            name="Paracetamol 500mg",
            sku_code="PCM-500-TEST",
            category="Analgesic / Antipyretic",
            unit_measurement="tablet",
            current_stock=150,
            safety_stock_level=80,
            supplier_id=supplier.id,
        ),
        Medicine(
            name="Amoxicillin 500mg",
            sku_code="AMX-500-TEST",
            category="Antibiotic",
            unit_measurement="capsule",
            current_stock=42,
            safety_stock_level=75,
            supplier_id=supplier_lookup["PT Sanbe Farma"].id,
        ),
        Medicine(
            name="Metformin 500mg",
            sku_code="MTF-500-TEST",
            category="Antidiabetic",
            unit_measurement="tablet",
            current_stock=320,
            safety_stock_level=100,
            supplier_id=supplier_lookup["PT Kalbe Farma"].id,
        ),
        Medicine(
            name="Omeprazole 20mg",
            sku_code="OMP-020-TEST",
            category="Gastrointestinal",
            unit_measurement="capsule",
            current_stock=28,
            safety_stock_level=45,
            supplier_id=supplier_lookup["PT Dexa Medica"].id,
        ),
    ]

    db.add_all(medicines)
    await db.flush()

    today = date.today()
    transactions: list[InventoryTransaction] = []
    predictions: list[DemandPrediction] = []
    for idx, medicine in enumerate(medicines):
        for day_offset in range(1, 9):
            transactions.append(
                InventoryTransaction(
                    medicine_id=medicine.id,
                    transaction_type=TransactionType.OUTGOING,
                    quantity=8 + idx * 3 + day_offset,
                    reference_note="Seed outpatient dispense",
                    created_by=user.id,
                )
            )
        for forecast_day in range(1, 11):
            predictions.append(
                DemandPrediction(
                    medicine_id=medicine.id,
                    target_date=today + timedelta(days=forecast_day),
                    predicted_demand=max(10, 12 + idx * 4 + forecast_day * 2),
                    confidence_score=0.72,
                )
            )

    draft_po = PurchaseOrder(
        po_number="PO-AI-SEED-001",
        supplier_id=supplier.id,
        status=POStatus.DRAFT_AI,
    )
    db.add(draft_po)
    await db.flush()
    db.add(
        PurchaseOrderItem(
            po_id=draft_po.id,
            medicine_id=medicines[1].id,
            order_quantity=120,
            unit_price_estimate=8500,
        )
    )

    db.add_all(transactions + predictions)
    await db.commit()

    return {"message": "Seed successful"}


@app.post("/api/seed")
async def seed_database(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Seed a minimal dataset for local transaction API testing."""

    return await _seed_demo_data(db)


@app.get("/api/medicines", response_model=list[MedicineResponse])
async def get_medicines(db: AsyncSession = Depends(get_db)) -> list[Medicine]:
    """Return all medicines from the database."""
    result = await db.execute(select(Medicine).order_by(Medicine.name.asc()))
    return result.scalars().all()


@app.get("/api/suppliers", response_model=list[SupplierResponse])
async def get_suppliers(db: AsyncSession = Depends(get_db)) -> list[Supplier]:
    """Return all suppliers from the database."""

    result = await db.execute(select(Supplier).order_by(Supplier.name.asc()))
    return result.scalars().all()


@app.patch("/api/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    supplier_in: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    """Update supplier fields managed from the supplier directory."""

    supplier = await db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    updates = supplier_in.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        if updates["status"] not in {"Active", "Inactive"}:
            raise HTTPException(status_code=422, detail="Supplier status must be Active or Inactive.")
        supplier.status = updates["status"]

    await db.commit()
    await db.refresh(supplier)
    return supplier


@app.post("/api/medicines", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(
    medicine_in: MedicineCreate,
    db: AsyncSession = Depends(get_db),
) -> Medicine:
    """Create a medicine catalogue item used by the frontend inventory screen."""

    existing = await db.execute(select(Medicine).where(Medicine.sku_code == medicine_in.sku_code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="SKU code already exists.")

    supplier_id = await _resolve_supplier_id(db, medicine_in.supplier_id)

    medicine = Medicine(**medicine_in.model_dump(exclude={"supplier_id"}), supplier_id=supplier_id)
    db.add(medicine)
    await db.commit()
    await db.refresh(medicine)
    return medicine


@app.patch("/api/medicines/{medicine_id}", response_model=MedicineResponse)
async def update_medicine(
    medicine_id: int,
    medicine_in: MedicineUpdate,
    db: AsyncSession = Depends(get_db),
) -> Medicine:
    """Update catalogue fields without touching transaction history."""

    medicine = await db.get(Medicine, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    updates = medicine_in.model_dump(exclude_unset=True)
    if "sku_code" in updates and updates["sku_code"] != medicine.sku_code:
        existing = await db.execute(select(Medicine).where(Medicine.sku_code == updates["sku_code"]))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="SKU code already exists.")

    if "supplier_id" in updates:
        updates["supplier_id"] = await _resolve_supplier_id(db, updates["supplier_id"])

    for field, value in updates.items():
        setattr(medicine, field, value)

    await db.commit()
    await db.refresh(medicine)
    return medicine


@app.delete("/api/medicines/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medicine(
    medicine_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an unused medicine catalogue item."""

    medicine = await db.get(Medicine, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    await db.delete(medicine)
    await db.commit()


app.include_router(transactions_router)
app.include_router(predictions_router)
app.include_router(restocking_router)
