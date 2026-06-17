from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.database.models import TransactionType


class TransactionCreate(BaseModel):
    """Input payload for creating a stock inventory transaction."""

    medicine_id: int
    transaction_type: TransactionType
    quantity: int = Field(gt=0, description="Quantity must be strictly greater than 0.")
    reference_note: str | None = None
    created_by: int


class TransactionResponse(BaseModel):
    """Transaction response including the medicine's updated current stock."""

    id: int
    medicine_id: int
    transaction_type: TransactionType
    quantity: int
    reference_note: str | None
    timestamp: datetime
    created_by: int
    current_stock: int

    model_config = ConfigDict(from_attributes=True)

