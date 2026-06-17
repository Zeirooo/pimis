from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.database.models import POStatus


class RestockingEvaluationResponse(BaseModel):
    """Result of evaluating whether a medicine needs restocking."""

    medicine_id: int
    medicine_name: str
    current_stock: int
    predicted_demand: int
    status: str
    recommended_po_qty: int
    draft_po_id: int | None
    draft_ai_summary: str | None = None
    draft_ai_factors: list[str] = Field(default_factory=list)


class ManualPurchaseOrderCreate(BaseModel):
    """Payload for creating a manual purchase order."""

    supplier_id: int | None = None
    po_number: str | None = None
    reviewed_by: int | None = None
    items: list["ManualPurchaseOrderItemCreate"] = Field(min_length=1)


class ManualPurchaseOrderItemCreate(BaseModel):
    """Single line item in a manual purchase order."""

    medicine_id: int
    order_quantity: int = Field(gt=0)
    unit_price_estimate: float | None = Field(default=None, ge=0)


class PurchaseOrderItemResponse(BaseModel):
    """Serialized purchase order item."""

    id: int
    po_id: int
    medicine_id: int
    order_quantity: int
    unit_price_estimate: float | None

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderResponse(BaseModel):
    """Serialized purchase order with nested items."""

    id: int
    po_number: str
    supplier_id: int
    status: POStatus
    created_at: datetime
    reviewed_by: int | None
    items: list[PurchaseOrderItemResponse]

    model_config = ConfigDict(from_attributes=True)

