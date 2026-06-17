from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PredictionCreate(BaseModel):
    """Request payload for generating a demand prediction."""

    medicine_id: int
    target_date: date


class PredictionResponse(BaseModel):
    """Serialized demand prediction response."""

    id: int
    medicine_id: int
    target_date: date
    predicted_demand: int
    confidence_score: float
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)

