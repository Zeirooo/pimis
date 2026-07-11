"""Enrich the local database with a realistic medicine catalogue and long demand history.

Two things the default startup seed doesn't provide, both needed to see the
ML pipeline behave like a real deployment instead of a bare-bones demo:

1. A catalogue that doesn't look sparse -- adds ~16 additional medicines
   across common pharmacy categories (idempotent: skipped if the SKU
   already exists).
2. ~120 days of backdated OUTGOING transaction history per medicine, with a
   slow upward trend, a weekly seasonality pattern, and *small* relative
   noise (~10% of daily demand). The previous version used flat +/- noise
   that was large relative to a low base demand, which pushed Prophet's
   uncertainty interval so wide that confidence_score always hit its 0.5
   floor -- tighter noise here lets the model actually look confident.

Run inside the backend container (or any environment with DB access):
    python -m backend.seed_ml_demo_data

Idempotent: reruns replace this script's own previously-seeded transactions
(tagged via reference_note) rather than piling up duplicates, and skip
medicines whose SKU already exists.
"""

from __future__ import annotations

import asyncio
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.database import SessionLocal
from backend.database.models import InventoryTransaction, Medicine, Supplier, TransactionType, User

DAYS_OF_HISTORY = 120
SEED_TAG = "ML demo seed (backend/seed_ml_demo_data.py)"

# (name, sku_code, category, unit, safety_stock_level, base_daily_demand)
ADDITIONAL_MEDICINES: list[tuple[str, str, str, str, int, int]] = [
    ("Ibuprofen 400mg", "IBU-400-DEMO", "Analgesic / Anti-inflammatory", "tablet", 90, 18),
    ("Azithromycin 500mg", "AZI-500-DEMO", "Antibiotic", "tablet", 60, 9),
    ("Cefixime 200mg", "CFX-200-DEMO", "Antibiotic", "capsule", 55, 8),
    ("Losartan 50mg", "LOS-050-DEMO", "Antihypertensive", "tablet", 110, 22),
    ("Amlodipine 10mg", "AML-010-DEMO", "Antihypertensive", "tablet", 100, 20),
    ("Simvastatin 20mg", "SIM-020-DEMO", "Statin", "tablet", 85, 16),
    ("Cetirizine 10mg", "CET-010-DEMO", "Antihistamine", "tablet", 70, 14),
    ("Loratadine 10mg", "LOR-010-DEMO", "Antihistamine", "tablet", 65, 12),
    ("Salbutamol Inhaler", "SAL-100-DEMO", "Bronchodilator", "inhaler", 30, 4),
    ("Furosemide 40mg", "FUR-040-DEMO", "Diuretic", "tablet", 45, 7),
    ("Ranitidine 150mg", "RAN-150-DEMO", "Gastrointestinal", "tablet", 75, 15),
    ("Domperidone 10mg", "DOM-010-DEMO", "Antiemetic", "tablet", 50, 9),
    ("Vitamin C 500mg", "VTC-500-DEMO", "Vitamin / Supplement", "tablet", 150, 30),
    ("Multivitamin Complex", "MVC-001-DEMO", "Vitamin / Supplement", "tablet", 140, 28),
    ("Dexamethasone 0.5mg", "DEX-005-DEMO", "Corticosteroid", "tablet", 40, 6),
    ("Fluconazole 150mg", "FLU-150-DEMO", "Antifungal", "capsule", 35, 5),
]


async def _get_or_create_medicines(db: AsyncSession) -> list[Medicine]:
    """Ensure the demo catalogue exists, skipping medicines that are already seeded."""

    suppliers = (await db.execute(select(Supplier))).scalars().all()
    if not suppliers:
        raise RuntimeError("No suppliers found. Start the app once so the base demo seed runs, then retry.")

    existing_by_sku = {m.sku_code: m for m in (await db.execute(select(Medicine))).scalars().all()}

    created: list[Medicine] = []
    for idx, (name, sku_code, category, unit, safety_stock, _base_demand) in enumerate(ADDITIONAL_MEDICINES):
        if sku_code in existing_by_sku:
            continue

        supplier = suppliers[idx % len(suppliers)]
        medicine = Medicine(
            name=name,
            sku_code=sku_code,
            category=category,
            unit_measurement=unit,
            current_stock=safety_stock * 2,
            safety_stock_level=safety_stock,
            supplier_id=supplier.id,
        )
        db.add(medicine)
        created.append(medicine)

    if created:
        await db.flush()

    return list(existing_by_sku.values()) + created


def _base_demand_for(medicine: Medicine, catalogue_base_demand: dict[str, int]) -> int:
    """Look up the intended base daily demand, falling back to a safety-stock heuristic."""

    if medicine.sku_code in catalogue_base_demand:
        return catalogue_base_demand[medicine.sku_code]
    return max(5, medicine.safety_stock_level // 10)


def _generate_quantity(base_demand: int, day_index: int, day: datetime) -> int:
    """Slow upward trend + weekly seasonality + small relative noise (~10% of demand)."""

    trend = 1 + 0.0015 * day_index
    weekday_factor = 0.55 if day.weekday() >= 5 else 1.0
    noise = random.gauss(0, base_demand * 0.1)
    return max(1, round(base_demand * trend * weekday_factor + noise))


async def main() -> None:
    async with SessionLocal() as db:
        medicines = await _get_or_create_medicines(db)
        user = (await db.execute(select(User).limit(1))).scalar_one_or_none()

        if not medicines or user is None:
            print("No medicines/users found. Start the app once first so the demo seed runs, then retry.")
            return

        medicine_ids = [medicine.id for medicine in medicines]
        await db.execute(
            delete(InventoryTransaction).where(
                InventoryTransaction.medicine_id.in_(medicine_ids),
                InventoryTransaction.reference_note == SEED_TAG,
            )
        )

        catalogue_base_demand = {sku_code: base_demand for _, sku_code, _, _, _, base_demand in ADDITIONAL_MEDICINES}

        random.seed(42)
        now = datetime.now(UTC)
        transactions: list[InventoryTransaction] = []

        for medicine in medicines:
            base_demand = _base_demand_for(medicine, catalogue_base_demand)
            for day_offset in range(DAYS_OF_HISTORY, 0, -1):
                day = now - timedelta(days=day_offset)
                day_index = DAYS_OF_HISTORY - day_offset
                quantity = _generate_quantity(base_demand, day_index, day)
                transactions.append(
                    InventoryTransaction(
                        medicine_id=medicine.id,
                        transaction_type=TransactionType.OUTGOING,
                        quantity=quantity,
                        reference_note=SEED_TAG,
                        timestamp=day,
                        created_by=user.id,
                    )
                )

        db.add_all(transactions)
        await db.commit()
        print(f"Seeded {len(medicines)} medicines ({len(ADDITIONAL_MEDICINES)} demo catalogue entries checked).")
        print(f"Inserted {len(transactions)} synthetic transactions across {DAYS_OF_HISTORY} days each.")


if __name__ == "__main__":
    asyncio.run(main())
