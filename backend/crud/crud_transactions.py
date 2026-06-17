from __future__ import annotations

from typing import Sequence

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as Session

from backend.database.models import InventoryTransaction, Medicine, TransactionType
from backend.schemas.transactions import TransactionCreate, TransactionResponse


async def create_inventory_transaction(db: Session, tx_in: TransactionCreate) -> TransactionResponse:
    """
    Create an inventory transaction and update the linked medicine stock.

    Enforces XOR Gateway logic:
    - INCOMING increases stock.
    - OUTGOING decreases stock only if sufficient stock exists.
    """

    medicine = await db.get(Medicine, tx_in.medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    # XOR Gateway logic for stock update
    if tx_in.transaction_type == TransactionType.INCOMING:
        medicine.current_stock += tx_in.quantity
    elif tx_in.transaction_type == TransactionType.OUTGOING:
        if tx_in.quantity > medicine.current_stock:
            raise HTTPException(status_code=400, detail="Insufficient stock.")
        medicine.current_stock -= tx_in.quantity
    else:
        # Defensive fallback in case an invalid enum slips through
        raise HTTPException(status_code=400, detail="Invalid transaction type.")

    transaction = InventoryTransaction(
        medicine_id=tx_in.medicine_id,
        transaction_type=tx_in.transaction_type,
        quantity=tx_in.quantity,
        reference_note=tx_in.reference_note,
        created_by=tx_in.created_by,
    )

    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    return TransactionResponse(
        id=transaction.id,
        medicine_id=transaction.medicine_id,
        transaction_type=transaction.transaction_type,
        quantity=transaction.quantity,
        reference_note=transaction.reference_note,
        timestamp=transaction.timestamp,
        created_by=transaction.created_by,
        current_stock=medicine.current_stock,
    )


async def get_transaction_history(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[TransactionResponse]:
    """
    Fetch transaction history ordered by most recent first.

    Each item includes the current medicine `current_stock` value.
    """

    stmt = (
        select(InventoryTransaction, Medicine.current_stock)
        .join(Medicine, InventoryTransaction.medicine_id == Medicine.id)
        .order_by(InventoryTransaction.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        TransactionResponse(
            id=tx.id,
            medicine_id=tx.medicine_id,
            transaction_type=tx.transaction_type,
            quantity=tx.quantity,
            reference_note=tx.reference_note,
            timestamp=tx.timestamp,
            created_by=tx.created_by,
            current_stock=current_stock,
        )
        for tx, current_stock in rows
    ]

