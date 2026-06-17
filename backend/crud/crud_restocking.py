from __future__ import annotations

from datetime import datetime, UTC
from typing import Sequence

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as Session
from sqlalchemy.orm import selectinload

from backend.database.models import (
    DemandPrediction,
    Medicine,
    POStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    User,
)
from backend.schemas.restocking import ManualPurchaseOrderCreate, RestockingEvaluationResponse


async def _load_purchase_order(db: Session, po_id: int) -> PurchaseOrder:
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == po_id)
    )
    result = await db.execute(stmt)
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found.")
    return po


async def evaluate_smart_restocking(
    db: Session,
    medicine_id: int,
    supplier_id: int | None = None,
) -> RestockingEvaluationResponse:
    """
    Evaluate stock against the most recent demand prediction and create a draft PO if needed.
    """

    medicine_stmt = select(Medicine).where(Medicine.id == medicine_id)
    medicine_result = await db.execute(medicine_stmt)
    medicine = medicine_result.scalar_one_or_none()

    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    prediction_stmt = (
        select(DemandPrediction)
        .where(DemandPrediction.medicine_id == medicine_id)
        .order_by(DemandPrediction.calculated_at.desc())
        .limit(1)
    )
    prediction_result = await db.execute(prediction_stmt)
    latest_prediction = prediction_result.scalar_one_or_none()
    predicted_demand = (
        latest_prediction.predicted_demand if latest_prediction is not None else medicine.safety_stock_level
    )
    draft_ai_factors = [
        f"Current stock: {medicine.current_stock}",
        f"Safety stock level: {medicine.safety_stock_level}",
        f"Predicted demand: {predicted_demand}",
    ]

    needs_restock = medicine.current_stock < medicine.safety_stock_level or predicted_demand > medicine.current_stock
    if not needs_restock:
        return RestockingEvaluationResponse(
            medicine_id=medicine.id,
            medicine_name=medicine.name,
            current_stock=medicine.current_stock,
            predicted_demand=predicted_demand,
            status="Enough Stock",
            recommended_po_qty=0,
            draft_po_id=None,
            draft_ai_summary="No draft created because stock is still above the restock threshold.",
            draft_ai_factors=draft_ai_factors,
        )

    selected_supplier_id = supplier_id if supplier_id is not None else medicine.supplier_id

    if supplier_id is not None:
        supplier_result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
        supplier = supplier_result.scalar_one_or_none()
        if supplier is None:
            raise HTTPException(status_code=404, detail="Supplier not found.")

    existing_draft_stmt = (
        select(PurchaseOrder)
        .join(PurchaseOrder.items)
        .options(selectinload(PurchaseOrder.items))
        .where(
            PurchaseOrder.status == POStatus.DRAFT_AI,
            PurchaseOrder.supplier_id == selected_supplier_id,
            PurchaseOrderItem.medicine_id == medicine.id,
        )
        .order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
        .limit(1)
    )
    existing_draft_result = await db.execute(existing_draft_stmt)
    existing_draft = existing_draft_result.scalar_one_or_none()
    if existing_draft is not None:
        existing_item = next((item for item in existing_draft.items if item.medicine_id == medicine.id), None)
        return RestockingEvaluationResponse(
            medicine_id=medicine.id,
            medicine_name=medicine.name,
            current_stock=medicine.current_stock,
            predicted_demand=predicted_demand,
            status="Low Stock",
            recommended_po_qty=existing_item.order_quantity if existing_item is not None else 0,
            draft_po_id=existing_draft.id,
            draft_ai_summary="Draft already exists for this medicine and supplier.",
            draft_ai_factors=draft_ai_factors,
        )

    recommended_po_qty = max(
        medicine.safety_stock_level - medicine.current_stock,
        predicted_demand - medicine.current_stock,
        1,
    )

    if supplier_id is None:
        return RestockingEvaluationResponse(
            medicine_id=medicine.id,
            medicine_name=medicine.name,
            current_stock=medicine.current_stock,
            predicted_demand=predicted_demand,
            status="Low Stock",
            recommended_po_qty=recommended_po_qty,
            draft_po_id=None,
            draft_ai_summary="Stock is low, but a supplier must be selected before the AI draft can be created.",
            draft_ai_factors=draft_ai_factors,
        )

    po_number = f"PO-AI-{medicine.id}-{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}"

    draft_purchase_order = PurchaseOrder(
        po_number=po_number,
        supplier_id=selected_supplier_id,
        status=POStatus.DRAFT_AI,
        reviewed_by=None,
    )
    db.add(draft_purchase_order)
    await db.flush()

    db.add(
        PurchaseOrderItem(
            po_id=draft_purchase_order.id,
            medicine_id=medicine.id,
            order_quantity=recommended_po_qty,
            unit_price_estimate=None,
        )
    )

    await db.commit()
    await db.refresh(draft_purchase_order)

    return RestockingEvaluationResponse(
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        current_stock=medicine.current_stock,
        predicted_demand=predicted_demand,
        status="Low Stock",
        recommended_po_qty=recommended_po_qty,
        draft_po_id=draft_purchase_order.id,
        draft_ai_summary="Draft PO created using stock and demand rules for manager review.",
        draft_ai_factors=draft_ai_factors,
    )


async def create_manual_purchase_order(
    db: Session,
    payload: ManualPurchaseOrderCreate,
) -> PurchaseOrder:
    """Create a manual purchase order with one or more medicines."""

    if not payload.items:
        raise HTTPException(status_code=400, detail="At least one purchase order item is required.")

    supplier_id = payload.supplier_id
    if supplier_id is not None:
        supplier_result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
        if supplier_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Supplier not found.")

    medicine_ids = [item.medicine_id for item in payload.items]
    medicine_result = await db.execute(select(Medicine).where(Medicine.id.in_(medicine_ids)))
    medicines = medicine_result.scalars().all()
    medicine_by_id = {medicine.id: medicine for medicine in medicines}

    if len(medicine_by_id) != len(set(medicine_ids)):
        raise HTTPException(status_code=404, detail="One or more medicines were not found.")

    if supplier_id is None:
        supplier_id = medicine_by_id[payload.items[0].medicine_id].supplier_id

    assert supplier_id is not None

    for item in payload.items:
        medicine = medicine_by_id[item.medicine_id]
        if medicine.supplier_id != supplier_id:
            raise HTTPException(
                status_code=400,
                detail="All medicines in a manual PO must belong to the selected supplier.",
            )

    po_number = payload.po_number.strip() if payload.po_number else ""
    if not po_number:
        po_number = f"PO-MANUAL-{medicine_ids[0]}-{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}"

    existing_po = await db.execute(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number))
    if existing_po.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="PO number already exists.")

    reviewed_by = None
    if payload.reviewed_by is not None:
        reviewed_by_user = await db.get(User, payload.reviewed_by)
        if reviewed_by_user is not None:
            reviewed_by = reviewed_by_user.id

    purchase_order = PurchaseOrder(
        po_number=po_number,
        supplier_id=supplier_id,
        status=POStatus.DRAFT_AI,
        reviewed_by=reviewed_by,
    )
    db.add(purchase_order)
    await db.flush()

    for item in payload.items:
        db.add(
            PurchaseOrderItem(
                po_id=purchase_order.id,
                medicine_id=item.medicine_id,
                order_quantity=item.order_quantity,
                unit_price_estimate=item.unit_price_estimate,
            )
        )
    await db.commit()

    return await _load_purchase_order(db, purchase_order.id)


async def get_purchase_orders(db: Session) -> Sequence[PurchaseOrder]:
    """Fetch all purchase orders with their items."""

    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().unique().all()


async def approve_purchase_order(db: Session, po_id: int) -> PurchaseOrder:
    """Approve a purchase order by ID."""

    po = await _load_purchase_order(db, po_id)

    po.status = POStatus.APPROVED
    await db.commit()
    return await _load_purchase_order(db, po_id)


async def reject_purchase_order(db: Session, po_id: int) -> PurchaseOrder:
    """Reject a purchase order by ID."""

    po = await _load_purchase_order(db, po_id)

    po.status = POStatus.REJECTED
    await db.commit()
    return await _load_purchase_order(db, po_id)

