from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date
from math import ceil
from statistics import mean
from typing import Sequence

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as Session

from backend.database.models import DemandPrediction, InventoryTransaction, Medicine, TransactionType
from backend.schemas.predictions import PredictionCreate


async def generate_demand_prediction(db: Session, req: PredictionCreate) -> DemandPrediction:
    """
    Generate and persist a baseline demand prediction for a medicine.

    This is a deterministic baseline forecaster. It aggregates outgoing
    transactions by day, estimates daily demand with a recency-weighted moving
    average, and adds a small trend adjustment when recent demand is rising.
    """

    medicine = await db.get(Medicine, req.medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    stmt = select(InventoryTransaction).where(
        InventoryTransaction.medicine_id == req.medicine_id,
        InventoryTransaction.transaction_type == TransactionType.OUTGOING,
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    if records:
        daily_demand: dict[date, int] = defaultdict(int)
        for record in records:
            tx_time = record.timestamp
            tx_date = tx_time.date() if tx_time.tzinfo else tx_time.replace(tzinfo=UTC).date()
            daily_demand[tx_date] += record.quantity

        ordered = [daily_demand[day] for day in sorted(daily_demand)]
        recent = ordered[-7:]
        previous = ordered[-14:-7]
        daily_average = mean(recent)

        if previous:
            trend = max(mean(recent) - mean(previous), 0)
        else:
            trend = 0

        days_ahead = max((req.target_date - date.today()).days, 1)
        horizon = min(days_ahead, 14)
        predicted_demand = max(1, ceil((daily_average + trend * 0.35) * horizon))
        confidence_score = min(0.92, 0.55 + len(ordered) * 0.03)
    else:
        predicted_demand = max(medicine.safety_stock_level, 1)
        confidence_score = 0.45

    prediction = DemandPrediction(
        medicine_id=req.medicine_id,
        target_date=req.target_date,
        predicted_demand=predicted_demand,
        confidence_score=round(confidence_score, 2),
    )

    db.add(prediction)
    await db.commit()
    await db.refresh(prediction)

    return prediction


async def get_prediction_history(db: Session, medicine_id: int) -> Sequence[DemandPrediction]:
    """Fetch stored demand predictions for a specific medicine."""

    stmt = (
        select(DemandPrediction)
        .where(DemandPrediction.medicine_id == medicine_id)
        .order_by(DemandPrediction.calculated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

