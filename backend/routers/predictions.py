from __future__ import annotations

from typing import Sequence

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.crud.crud_predictions import generate_demand_prediction, get_prediction_history
from backend.database.database import get_db
from backend.schemas.predictions import PredictionCreate, PredictionResponse


router = APIRouter(prefix="/api/predictions", tags=["ML Predictions"])


@router.post("/", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
async def create_prediction(
    req: PredictionCreate,
    db: AsyncSession = Depends(get_db),
) -> PredictionResponse:
    """Trigger the demand prediction engine for a medicine."""

    return await generate_demand_prediction(db, req)


@router.get("/{medicine_id}", response_model=list[PredictionResponse])
async def list_predictions(
    medicine_id: int,
    db: AsyncSession = Depends(get_db),
) -> Sequence[PredictionResponse]:
    """Fetch prediction history for a specific medicine."""

    return await get_prediction_history(db, medicine_id)

