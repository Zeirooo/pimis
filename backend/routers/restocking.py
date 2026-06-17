from __future__ import annotations

from typing import Sequence

from fastapi import APIRouter, Depends
from fastapi import Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.crud.crud_restocking import (
    approve_purchase_order,
    create_manual_purchase_order,
    evaluate_smart_restocking,
    get_purchase_orders,
    reject_purchase_order,
)
from backend.database.database import get_db
from backend.schemas.restocking import (
    ManualPurchaseOrderCreate,
    PurchaseOrderResponse,
    RestockingEvaluationResponse,
)


router = APIRouter(prefix="/api/restocking", tags=["Smart Restocking"])


@router.post("/evaluate/{medicine_id}", response_model=RestockingEvaluationResponse)
async def evaluate_restocking(
    medicine_id: int,
    supplier_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> RestockingEvaluationResponse:
    """Run the smart restocking evaluation for a medicine."""

    return await evaluate_smart_restocking(db, medicine_id, supplier_id)


@router.get("/purchase-orders", response_model=list[PurchaseOrderResponse])
async def list_purchase_orders(
    db: AsyncSession = Depends(get_db),
) -> Sequence[PurchaseOrderResponse]:
    """Fetch all purchase orders with their items."""

    return await get_purchase_orders(db)


@router.post("/purchase-orders/manual", response_model=PurchaseOrderResponse, status_code=201)
async def create_manual_po(
    payload: ManualPurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
) -> PurchaseOrderResponse:
    """Create a manual purchase order for a selected medicine."""

    return await create_manual_purchase_order(db, payload)


@router.patch("/purchase-orders/{po_id}/approve", response_model=PurchaseOrderResponse)
async def approve_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
) -> PurchaseOrderResponse:
    """Approve a purchase order."""

    return await approve_purchase_order(db, po_id)


@router.patch("/purchase-orders/{po_id}/reject", response_model=PurchaseOrderResponse)
async def reject_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
) -> PurchaseOrderResponse:
    """Reject a purchase order."""

    return await reject_purchase_order(db, po_id)

