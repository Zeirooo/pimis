"""CRUD operations for generating and reading demand predictions."""

from __future__ import annotations

from typing import Sequence

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as Session

from backend.database.models import DemandPrediction, InventoryTransaction, Medicine, TransactionType
from backend.ml.heuristic import heuristic_predict
from backend.ml.predictor import predict_demand
from backend.ml.registry import ModelRegistry
from backend.schemas.predictions import PredictionCreate


async def generate_demand_prediction(db: Session, req: PredictionCreate, registry: ModelRegistry) -> DemandPrediction:
    """Generate and persist a demand prediction for a medicine.

    Tries the medicine's trained Prophet model first, then its scikit-learn
    model, and falls back to the deterministic heuristic forecaster when
    neither ML model is available (or there isn't enough history to have
    trained one yet).
    """

    medicine = await db.get(Medicine, req.medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    stmt = select(InventoryTransaction).where(
        InventoryTransaction.medicine_id == req.medicine_id,
        InventoryTransaction.transaction_type == TransactionType.OUTGOING,
    )
    result = await db.execute(stmt)
    transactions = list(result.scalars().all())

    predicted_demand, confidence_score = await predict_demand(req.medicine_id, req.target_date, registry, transactions)

    if predicted_demand <= 0:
        predicted_demand, confidence_score = heuristic_predict(
            transactions, req.target_date, medicine.safety_stock_level
        )

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
